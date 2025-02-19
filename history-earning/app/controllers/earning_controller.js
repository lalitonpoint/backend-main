let Country = require('mongoose').model('Country')
let City = require('mongoose').model('City')
let Trip_history = require('mongoose').model('Trip_history')
let Trip = require('mongoose').model('Trip')
let queue_manager = require('./queue_manager')
let moment = require('moment');
let utils = require('./utils')
let xl = require('excel4node');
let mExportDataController = require('./earning_controller.js')
let Export_history = require('mongoose').model('export_history');
let mongoose = require('mongoose');
let Schema = mongoose.Types.ObjectId;
let Settings = require('mongoose').model('Settings')
let Wallet_history = require('mongoose').model('Wallet_history');
let Redeem_point_history = require('mongoose').model('redeem_point_history');
let Transfer_history = require('mongoose').model('transfer_history');
let User = require('mongoose').model('User')
let Partner = require('mongoose').model('Partner')
let Provider = require('mongoose').model('Provider')
let Provider_daily_analytic = require('mongoose').model('provider_daily_analytic')
let OpenRide = require('mongoose').model('Open_Ride');
let City_type = require('mongoose').model('city_type');
let Rental_Trip = require('mongoose').model('Rental_Trip');

const {
    TRIP_LIST,
    EXPORT_HISTORY_STATUS,
    PROVIDER_STATUS,
    COLLECTION
} = require('./constant.js')
const {
    TYPE_MESSAGE_CODE,
    HIDE_DETAILS
} = require('../utils/success_code.js')

exports.weekly_and_daily_earning = async function(req,res){
    try{
        let params_trips = [{ name: "earning_type", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_trips)
        if (!response.success) {
            res.json(response)
            return;
        }

        if (req.body.is_export) {
            req.query.host = req.get('host')
            req.query.protocol = req.protocol
            let type

            if (req.body.earning_type == 'Daily_earning') {
                type = TRIP_LIST.DAILY_EARNING
            } else {
                type = TRIP_LIST.WEEKLY_EARNING
            }
            let request = {
                body: req.body,
                headers: {
                    is_show_email: req.headers.is_show_email,
                    is_show_phone: req.headers.is_show_phone,
                }
            }
            queue_manager.earningExportQueue.add(request,{
                     jobId: Date.now()
                }).then((job) => {
                let export_history = new Export_history({
                    type: type,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id:req.body.export_user_id,
                    data: job.data
                })
                export_history.save()
                return res.json({ 
                    success: true,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: ""  
                });
            });
            return;
        }
        mExportDataController.weekly_and_daily_earning_req_post(req, res);

    }catch(err){
        utils.error_response(err, req, res)
    }
}

//api for get trip list for daily and weekly earning
exports.weekly_and_daily_earning_req_post = async function (req, res) {
    try {
        let params_trips = [{ name: "earning_type", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_trips)
        if (!response.success) {
            res.json(response)
            return;
        }

        if(!req.body){
            req.body = req
        }
        let page;
        let next;
        let pre;
        let search_item;
        let search_value;
        let filter_start_date;
        let filter_end_date;
        let week_start_date_view = "";
        let week_end_date_view = "";
        let selected_country = req.body.selected_country ?  req.body.selected_country  :'all';
        let selected_city = req.body.selected_city;
        if (req.body.page == undefined) {
            page = 0;
            next = 1;
            pre = 0;
        } else {
            page = req.body.page;
            next = parseInt(req.body.page) + 1;
            pre = req.body.page - 1;
        }

        if (req.body.search_item == undefined) {
            search_item = 'provider_detail.first_name';
            search_value = '';
            filter_start_date = '';
            filter_end_date = '';
        } else {
            search_item = req.body.search_item;
            search_value = req.body.search_value;
            filter_start_date = req.body.start_date;
            filter_end_date = req.body.end_date;
        }

        let start_date = req.body.start_date
        let end_date = req.body.end_date
        let earning_type = req.body.earning_type
        let number_of_rec = req.body.limit;

        let country_filter = { "$match": {} };
        let city_filter = { "$match": {} };
        let timezone = "";

        if (selected_country !== 'all') {
            let country = await Country.findOne({ _id: Schema(selected_country) })
            if (country) {
                timezone = country.country_all_timezone[0];
            }
            country_filter['$match']['country_id'] = { $eq: Schema(selected_country) };
            if (selected_city !== 'all') {
                let city = await City.findOne({ _id: selected_city })
                if (city) {
                    timezone = city.timezone;
                }
                city_filter['$match']['city_id'] = { $eq: Schema(selected_city) };
            }
        }

        let search = { "$match": {} };
        let value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');
        if (search_item == "provider_detail.first_name") {
            let query1 = {};
            let query2 = {};
            let query4 = {};
            let query5 = {};

            let full_name = value.split(' ');
            if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['provider_detail.last_name'] = { $regex: new RegExp(value, 'i') };

                search = { "$match": { $or: [query1, query2] } };
            } else {

               query4['provider_detail.first_name'] = { $regex: new RegExp(full_name[0], 'i') };
                query5['provider_detail.last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                search = { "$match": { $and: [query4, query5] } };
            }
        } else {
            search["$match"][search_item] = { $regex: value };
        }

        let trip_filter = { "$match": {} };
        if(start_date && end_date) {
            const startDate = moment(start_date).startOf('day').toDate();
            const endDate = moment(end_date).endOf('day').toDate();
            trip_filter["$match"]['complete_date_in_city_timezone'] = { $gte: startDate, $lt: endDate };
        }

        ///// For Count number of result /////
        let count = { $group: { _id: null, total: { $sum: 1 }, data: { $push: '$data' } } };

        //// For skip number of result /////
        let skip = {};
        skip["$skip"] = page * number_of_rec;


        let sort = {}
        let sort_item = req.body.sort_item 
        let sort_order = Number(req.body.sort_order)
        if(sort_item && sort_order){
            sort = {$sort:{
                [sort_item] : sort_order
            }}
        } else {
            sort = { $sort: { provider_trip_end_time: -1 } }
        }

        ///// For limitation on result /////
        let limit = {};
        limit["$limit"] = number_of_rec;

        let trip_condition = { 'is_trip_completed': 1 };
        let trip_condition_new = { $and: [{ 'is_trip_cancelled_by_user': 1 }, { 'pay_to_provider': { $gt: 0 } }] };
        trip_condition = { $match: { $or: [trip_condition, trip_condition_new] } };

        // provider not null condition 
        let provider_exists_condition = { $match: { provider_id: { $ne: null } } };

        let trip_group_condition = {
            $group: {
                _id: '$provider_id',
                total_trip: { $sum: 1 },
                completed_trip: { $sum: { $cond: [{ $eq: ["$is_trip_completed", 1] }, 1, 0] } },
                total: { $sum: '$total' },
                provider_have_cash: { $sum: '$provider_have_cash' },
                provider_service_fees: { $sum: '$provider_service_fees' },
                card_payment: { $sum: '$card_payment' },
                cash_payment: { $sum: '$cash_payment' },
                wallet_payment: { $sum: '$wallet_payment' },
                unique_id: { $first: '$unique_id' },
                pay_to_provider: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', false] }, { '$eq': ['$is_transfered', false] }] }, '$pay_to_provider', 0] } },
                currency: { $first: '$currency' },
                provider_id: { $first: '$provider_id' },
                provider_unique_id: { $first: '$provider_unique_id' },
                provider_first_name: { $first: '$provider_first_name' },
                provider_last_name: { $first: '$provider_last_name' },
                provider_phone: { $first: '$provider_phone' },
                provider_phone_code: { $first: '$provider_phone_code' },
            }
        }
        let project = {
            $project: {
                _id: 1,
                total_trip: 1,
                completed_trip: 1,
                total: 1,
                provider_have_cash: 1,
                provider_service_fees: 1,
                card_payment: 1,
                cash_payment: 1,
                wallet_payment: 1,
                unique_id: 1,
                pay_to_provider: 1,
                currency: 1,
                "provider_detail._id": { $ifNull: ["$provider_id", "000000000000000000000000"] },
                "provider_detail.unique_id": { $ifNull: ["$provider_unique_id", 0] },
                "provider_detail.first_name": "$provider_first_name",
                "provider_detail.last_name": "$provider_last_name",
                "provider_detail.phone": !req.headers.is_show_phone ? HIDE_DETAILS.PHONE : { $ifNull: ["$provider_phone", HIDE_DETAILS.PHONE] },
                "provider_detail.country_phone_code": !req.headers.is_show_phone ? HIDE_DETAILS.COUNTRY_CODE : { $ifNull: ["$provider_phone_code", HIDE_DETAILS.COUNTRY_CODE] },
            }
        }

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.TRIP, req.headers)

        if (req.body.is_export) {
            let trips = await Trip_history.aggregate([{ $match: country_city_condition }, trip_condition, trip_filter, country_filter, city_filter, provider_exists_condition, trip_group_condition, project, search, sort])
            generate_trip_earning_excel(req, res, trips , req.body.header)
            return
        }

        let trips = await Trip_history.aggregate([{ $match: country_city_condition }, trip_condition, trip_filter, country_filter, city_filter, provider_exists_condition, trip_group_condition, project, search, sort, count])

        if (trips.length == 0) {
            trips = [];
            return res.json({ 
                success: true, 
                success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                success_message: "",
                detail: trips, 'current_page': 1, type: req.body.type, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, start_date: start_date, end_date: end_date, search_item, search_value, filter_start_date, filter_end_date, week_start_date_view: week_start_date_view, week_end_date_view: week_end_date_view, is_show_email: req.headers.is_show_email, is_show_phone : req.headers.is_show_phone   
            });

        } else {
            let pages = Math.ceil(trips[0].total / number_of_rec);

            trips = await Trip_history.aggregate([{ $match: country_city_condition }, trip_condition, trip_filter, country_filter, city_filter, provider_exists_condition, trip_group_condition, project, search, sort, skip, limit])

            if (trips.length == 0) {
                trips = [];
                return res.json({ 
                    success: true, 
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: "",  
                    detail: trips, 'current_page': 1, type: req.body.type, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, start_date: start_date, end_date: end_date, filter_start_date, filter_end_date, week_start_date_view: week_start_date_view, week_end_date_view: week_end_date_view, search_item, search_value, is_show_email: req.headers.is_show_email, is_show_phone : req.headers.is_show_phone
                });

            } else {
                let trip_group_condition_total = {
                    $group: {
                        _id: null,
                        total_trip: { $sum: 1 },
                        completed_trip: { $sum: { $cond: [{ $eq: ["$is_trip_completed", 1] }, 1, 0] } },
                        total: { $sum: '$total' },
                        promo_payment: { $sum: '$promo_payment' },
                        card_payment: { $sum: '$card_payment' },
                        cash_payment: { $sum: '$cash_payment' },
                        wallet_payment: { $sum: '$wallet_payment' },
                        admin_earning: { $sum: { $subtract: ['$total', '$provider_service_fees'] } },
                        admin_earning_in_currency: { $sum: { $subtract: ['$total_in_admin_currency', '$provider_service_fees_in_admin_currency'] } },
                        provider_earning: { $sum: '$provider_service_fees' },
                        provider_have_cash: { $sum: '$provider_have_cash' },
                        pay_to_provider: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', false] }, { '$eq': ['$is_transfered', false] }] }, '$pay_to_provider', 0] } },
                        currency: {$first:'$currency'}

                    }
                }
                if (earning_type == 'weekly') {
                    trip_group_condition_total = {
                        $group: {
                            _id: null,
                            total_trip: { $sum: 1 },
                            completed_trip: { $sum: { $cond: [{ $eq: ["$is_trip_completed", 1] }, 1, 0] } },
                            total: { $sum: '$total' },
                            promo_payment: { $sum: '$promo_payment' },
                            card_payment: { $sum: '$card_payment' },
                            cash_payment: { $sum: '$cash_payment' },
                            wallet_payment: { $sum: '$wallet_payment' },
                            admin_earning: { $sum: { $subtract: ['$total', '$provider_service_fees'] } },
                            admin_earning_in_currency: { $sum: { $subtract: ['$total_in_admin_currency', '$provider_service_fees_in_admin_currency'] } },
                            provider_earning: { $sum: '$provider_service_fees' },
                            provider_have_cash: { $sum: '$provider_have_cash' },
                            pay_to_provider: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', false] }, { '$eq': ['$is_transfered', false] }] }, '$pay_to_provider', 0] } },
                            currency: {$first:'$currency'}

                        }
                    }
                }
                let project = {
                    $project: {
                        is_trip_completed: 1,
                        total: 1,
                        promo_payment: 1,
                        card_payment: 1,
                        cash_payment: 1,
                        wallet_payment: 1,
                        provider_service_fees: 1,
                        total_in_admin_currency: 1,
                        provider_service_fees_in_admin_currency: 1,
                        provider_have_cash: 1,
                        is_provider_earning_set_in_wallet: 1,
                        is_transfered: 1,
                        pay_to_provider: 1,
                        currency: 1,
                        "provider_detail._id": { $ifNull: ["$provider_id", "000000000000000000000000"] },
                        "provider_detail.unique_id": { $ifNull: ["$provider_unique_id", 0] },
                        "provider_detail.first_name": "$provider_first_name",
                        "provider_detail.last_name": "$provider_last_name",
                        "provider_detail.phone": { $ifNull: ["$provider_phone", HIDE_DETAILS.PHONE] },
                        "provider_detail.country_phone_code": { $ifNull: ["$provider_phone_code", HIDE_DETAILS.COUNTRY_CODE] },
                    }
                }

                let trip_total = await Trip_history.aggregate([{ $match: country_city_condition }, trip_condition, trip_filter, country_filter, city_filter, provider_exists_condition, project, search, trip_group_condition_total])

                if (trip_total.length == 0) {
                    trips = [];
                    return res.json({ 
                        success: true, 
                        success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                        success_message: "", 
                        detail: trips, 'current_page': 1, type: req.body.type, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, start_date: start_date, end_date: end_date, week_start_date_view, week_end_date_view: week_end_date_view, search_item, search_value, filter_start_date, filter_end_date, is_show_email: req.headers.is_show_email, is_show_phone : req.headers.is_show_phone 
                    });
                } else {

                    return res.json({ 
                        success: true, 
                        success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                        success_message: "",  
                        detail: trips, 'current_page': page, trip_total: trip_total, type: req.body.type, 'pages': pages, 'next': next, 'pre': pre, moment: moment, start_date: start_date, end_date: end_date, week_start_date_view: week_start_date_view, week_end_date_view: week_end_date_view, search_item, search_value, filter_start_date, filter_end_date, is_show_email: req.headers.is_show_email, is_show_phone : req.headers.is_show_phone
                    });

                }
            }
        }
    } catch (err) {
        utils.error_response(err, req, res)
    }
}

async function generate_trip_earning_excel(req, res, array, header) {
    let setting_detail = await Settings.findOne({},{history_base_url: 1,timezone_for_display_date:1})
    const currentDate = moment().tz(setting_detail.timezone_for_display_date).format('HHmm_DDMMYYYY');
    let wb = new xl.Workbook();
    let ws = wb.addWorksheet('sheet1');
    let col = 1;
    let title = JSON.parse(header);
    ws.cell(1, col++).string(title.trip_id);
    ws.cell(1, col++).string(title.trip_end);
    ws.cell(1, col++).string(title.driver_id);
    ws.cell(1, col++).string(title.name);
    ws.cell(1, col++).string(title.phone);
    ws.cell(1, col++).string(title.total);
    ws.cell(1, col++).string(title.cash);
    ws.cell(1, col++).string(title.card);
    ws.cell(1, col++).string(title.wallet);
    ws.cell(1, col++).string(title.driver_profit);
    ws.cell(1, col++).string(title.pay_to_driver);

    array.forEach(function (data, index) {
        col = 1;
        ws.cell(index + 2, col++).number(data.unique_id || data.provider_detail.unique_id);
        ws.cell(index + 2, col++).string(moment(data.provider_trip_end_time).format("DD MMM 'YY") + ' ' + moment(data.created_at).format("hh:mm a"));

        if (data.provider_detail) {
            ws.cell(index + 2, col++).number(data.provider_detail.unique_id);
            ws.cell(index + 2, col++).string(data.provider_detail.first_name + ' ' + data.provider_detail.last_name);
            ws.cell(index + 2, col++).string(data.provider_detail.country_phone_code + data.provider_detail.phone);
        } else {
            col += 3;
        }

        ws.cell(index + 2, col++).number(data.total);
        ws.cell(index + 2, col++).number(data.provider_have_cash);
        ws.cell(index + 2, col++).number(data.card_payment);
        ws.cell(index + 2, col++).number(data.wallet_payment);
        ws.cell(index + 2, col++).number(data.provider_service_fees);
        ws.cell(index + 2, col++).number(data.pay_to_provider);

        if (index == array.length - 1) {

            wb.write('data/xlsheet/'+ ( req.body.earning_type ? req.body.earning_type : "Trip_earning" ) + '_' + currentDate + '.xlsx', async function (err) {
                if (err) {
                    console.error(err);
                } else {                    
                    let url = setting_detail.history_base_url +"/xlsheet/" + ( req.body.earning_type ? req.body.earning_type : "Trip_earning" ) + '_' + currentDate + '.xlsx';
                    if(res.json){
                        res.json(url);
                    }else{
                        res(url);
                    }
                    
                    //Old Code:
                    // let url = req.protocol + "://" + req.get('host') + "/xlsheet/" + time + "_trip_earning.xlsx";
                    // res.json(url);
                    // setTimeout(function () {
                    //     fs.unlink('data/xlsheet/' + time + '_trip_earning.xlsx', function () {
                    //     });
                    // }, 10000)
                }
            });
        }
    });
}

exports.trip_earning = async function(req,res){
    try{
        if (req.body.is_export) {
            req.query.host = req.get('host')
            req.query.protocol = req.protocol

            let request = {
                body: req.body,
                headers: {
                    is_show_email: req.headers.is_show_email,
                    is_show_phone: req.headers.is_show_phone,
                }
            }
            queue_manager.earningExportQueueOfTrip.add(request,{
                     jobId: Date.now()
                }).then((job) => {
                let export_history = new Export_history({
                    type: TRIP_LIST.EARNING_TRIP,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id:req.body.export_user_id,
                    data: job.data
                })
                export_history.save()
                return res.json({ 
                    success: true,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: ""  
                });
            });
            return;
        }
        mExportDataController.trip_earning_req_post(req, res);

    }catch(err){
        utils.error_response(err, req, res)
    }
}

//api for get trip list for trip earning
exports.trip_earning_req_post = async function (req, res) {
    if(!req.body){
        req.body = req
    }
    let search_item;
    let search_value;
    let start_date = req.body.start_date
    let end_date = req.body.end_date
    let selected_country = req.body.selected_country;
    let selected_city = req.body.selected_city;

    if (req.body.search_item == undefined) {
        search_item = 'provider_detail.first_name';
        search_value = '';
    } else {
        search_item = req.body.search_item;
        search_value = req.body.search_value;
    }

    let country_filter = { $match: {} };
    let city_filter = { $match: {} };
    let timezone = "";

    if (selected_country !== 'all') {
        let country = await Country.findOne({ _id: Schema(selected_country) })
        if (country) {
            timezone = country.country_all_timezone[0];
        }
        country_filter['$match']['country_id'] = { $eq: Schema(selected_country) };
        if (selected_city !== 'all') {
            let city = await City.findOne({ _id: selected_city })
            if (city) {
                timezone = city.timezone;
            }
            city_filter['$match']['city_id'] = { $eq: Schema(selected_city) };
        }
    }

    let search = { "$match": {} };
    let value = search_value;
    value = value.trim();
    value = value.replace(/ +(?= )/g, '');
    if (search_item == "provider_detail.first_name") {
        let query1 = {};
        let query2 = {};
        let query4 = {};
        let query5 = {};

        let full_name = value.split(' ');
        if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {

            query1[search_item] = { $regex: new RegExp(value, 'i') };
            query2['provider_detail.last_name'] = { $regex: new RegExp(value, 'i') };

            search = { "$match": { $or: [query1, query2] } };
        } else {

            query4['provider_detail.first_name'] = { $regex: new RegExp(full_name[0], 'i') };
            query5['provider_detail.last_name'] = { $regex: new RegExp(full_name[1], 'i') };
            search = { "$match": { $and: [query4, query5] } };
        }
    } else {
        if (value.length) {
            search["$match"][search_item] = { $regex: value };
            if (search_item == "unique_id") {
                search["$match"][search_item] = Number(value)
            }
        }
    }
    let trip_filter = { "$match": {} };

    let sort = {}
    let sort_item = req.body.sort_item 
    let sort_order = Number(req.body.sort_order)
    if(sort_item && sort_order){
        sort = {$sort:{
            [sort_item] : sort_order
        }}
    } else {
        sort = { $sort: { provider_trip_end_time: -1 } }
    }

    if (selected_city == 'all') {
        selected_city = null
    }

    if(start_date && end_date) {
        const startDate = moment(start_date).startOf('day').toDate();
        const endDate = moment(end_date).endOf('day').toDate();
        trip_filter["$match"]['complete_date_in_city_timezone'] = { $gte: startDate, $lt: endDate };
    }

    let trip_condition = { 'is_trip_completed': 1 };
    let trip_condition_new = { $and: [{ 'is_trip_cancelled_by_user': 1 }, { 'pay_to_provider': { $gt: 0 } }] };
    trip_condition = { $match: { $or: [trip_condition, trip_condition_new] } };

    let limit = Number(req.body.limit)
    let page = Number(req.body.page)
    let count
    let pagination
    if (page !== null && !req.body.is_export) {
        let number_of_rec = limit;
        let start = ((page + 1) * number_of_rec) - number_of_rec;
        let end = number_of_rec;
        count = { $group: { _id: null, total: { $sum: 1 }, result: { $push: "$$ROOT" } } };
        pagination = { $project: { total: { $ceil: { $divide: ['$total', limit] } }, data: { $slice: ['$result', start, end] } } }

    } else {
        count = { $group: { _id: null, total: { $sum: 1 }, result: { $push: "$$ROOT" } } };
        pagination = { $project: { total: 1, data: '$result' } }
    }

    // Country and city based restriction condition
    let country_city_condition = await utils.get_country_city_condition(COLLECTION.TRIP, req.headers)

    // project optimize query
    let Project = {
        $project: {
            unique_id: 1,
            provider_trip_end_time: 1,
            "provider_detail._id": { $ifNull: ["$current_provider", "000000000000000000000000"] },
            "provider_detail.unique_id": { $ifNull: ["$provider_unique_id", 0] },
            "provider_detail.first_name": "$provider_first_name",
            "provider_detail.last_name": "$provider_last_name",
            "provider_detail.phone": !req.headers.is_show_phone ? HIDE_DETAILS.PHONE : { $ifNull: ["$provider_phone", HIDE_DETAILS.PHONE] },
            "provider_detail.country_phone_code": !req.headers.is_show_phone ? HIDE_DETAILS.COUNTRY_CODE : { $ifNull: ["$provider_phone_code", HIDE_DETAILS.COUNTRY_CODE] },
            total_in_admin_currency: 1,
            provider_service_fees_in_admin_currency: 1,
            currency: 1,
            total: 1,
            card_payment: 1,
            cash_payment: 1,
            wallet_payment: 1,
            provider_service_fees: 1,
            pay_to_provider: 1,
            provider_have_cash: 1,
            promo_payment: 1,
            is_trip_completed: 1
        }
    }

    if (req.body.is_export) {
        Project = {
            $project: {
                unique_id: 1,
                provider_trip_end_time: 1,
                created_at: 1,
                "provider_detail._id": { $ifNull: ["$current_provider", "000000000000000000000000"] },
                "provider_detail.unique_id": { $ifNull: ["$provider_unique_id", 0] },
                "provider_detail.first_name": "$provider_first_name",
                "provider_detail.last_name": "$provider_last_name",
                "provider_detail.phone": !req.headers.is_show_phone ? HIDE_DETAILS.PHONE : { $ifNull: ["$provider_phone", HIDE_DETAILS.PHONE] },
                "provider_detail.country_phone_code": !req.headers.is_show_phone ? HIDE_DETAILS.COUNTRY_CODE : { $ifNull: ["$provider_phone_code", HIDE_DETAILS.COUNTRY_CODE] },
                total_in_admin_currency: 1,
                provider_service_fees_in_admin_currency: 1,
                total: 1,
                card_payment: 1,
                cash_payment: 1,
                wallet_payment: 1,
                provider_service_fees: 1,
                pay_to_provider: 1,
                provider_have_cash: 1,
                promo_payment: 1,
                is_trip_completed: 1
            }
        }
    }

    let trips = await Trip_history.aggregate([{ $match: country_city_condition }, trip_condition, trip_filter, country_filter, city_filter, Project, search, sort, count, pagination])
    if (req.body.is_export) {
        generate_trip_earning_excel(req, res, trips[0].data, req.body.header)
        return
    }

    if (trips.length == 0) {
        res.json({ 
            success: true, detail: [], pages: 0, is_show_email: req.headers.is_show_email, is_show_phone: req.headers.is_show_phone,
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message: "",  
        });
        return;
    }

    let trip_group_condition_total = {
        $group: {
            _id: null,
            total_trip: { $sum: 1 },
            completed_trip: { $sum: { $cond: [{ $eq: ["$is_trip_completed", 1] }, 1, 0] } },
            total: { $sum: { $add: ['$total', '$promo_payment'] } },
            promo_payment: { $sum: '$promo_payment' },
            card_payment: { $sum: '$card_payment' },
            cash_payment: { $sum: '$cash_payment' },
            wallet_payment: { $sum: '$wallet_payment' },
            admin_earning: { $sum: { $subtract: ['$total', '$provider_service_fees'] } },
            admin_earning_in_currency: { $sum: { $subtract: ['$total_in_admin_currency', '$provider_service_fees_in_admin_currency'] } },
            provider_earning: { $sum: '$provider_service_fees' },
            provider_have_cash: { $sum: '$provider_have_cash' },
            pay_to_provider: { $sum: '$pay_to_provider' }
        }
    }
    let trip_total = await Trip_history.aggregate([{ $match: country_city_condition }, trip_condition, trip_filter, country_filter, city_filter, Project, search, trip_group_condition_total])
    if (trip_total.length == 0) {
        res.json({ 
            success: true, detail: trips[0].data, trip_total: [], pages: trips[0].total, is_show_email: req.headers.is_show_email, is_show_phone: req.headers.is_show_phone,
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message: "",  
        });
        return;
    }
    return res.json({ 
        success: true, detail: trips[0].data, trip_total: trip_total, pages: trips[0].total, is_show_email: req.headers.is_show_email, is_show_phone: req.headers.is_show_phone,
        success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
        success_message: "",  
    });
}

exports.partner_weekly_earning = async function(req,res){
    try{
        if (req.body.is_export) {
            req.query.host = req.get('host')
            req.query.protocol = req.protocol
            let request = {
                body: req.body,
                headers: {
                    is_show_email: req.headers.is_show_email,
                    is_show_phone: req.headers.is_show_phone,
                }
            }
            queue_manager.earningExportQueueOfPartner.add(request,{
                     jobId: Date.now()
                }).then((job) => {
                let export_history = new Export_history({
                    type: TRIP_LIST.PARTNER_WEEKLY_EARNING,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id:req.body.export_user_id,
                    data: job.data
                })
                export_history.save()
                return res.json({ 
                    success: true,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: ""  
                });
            });
            return;
        }
        mExportDataController.partner_weekly_earning_req_post(req, res);

    }catch(err){
        utils.error_response(err, req, res)
    }
}

//api for get partner weekly earning
exports.partner_weekly_earning_req_post = async function (req, res) {
    try {
        if(!req.body){
            req.body = req
        }

        let page;
        let next;
        let pre;
        let search_item;
        let search_value;
        let sort_field;
        let filter_start_date;
        let filter_end_date;
        let selected_country = req.body.selected_country;
        let selected_city = req.body.selected_city;
        let start_date = req.body.start_date;
        let end_date = req.body.end_date;
        if (req.body.page == undefined) {
            page = 0;
            next = 1;
            pre = 0;
        } else {
            page = req.body.page;
            next = parseInt(req.body.page) + 1;
            pre = req.body.page - 1;
        }

        if (req.body.search_item == undefined) {
            search_item = 'provider_detail.first_name';
            search_value = '';
        } else {
            search_item = req.body.search_item;
            search_value = req.body.search_value;
        }

        let week_start_date_view = "";
        let week_end_date_view = "";

        if ( start_date && end_date ) {
            week_start_date_view = start_date;
            week_end_date_view = end_date;
        } else {

            let today = new Date();
            end_date = new Date(today.setDate(today.getDate() + 6 - today.getDay()));
            today = new Date(end_date);
            start_date = new Date(today.setDate(today.getDate() - 6));

            start_date = start_date.setHours(0, 0, 0, 0);
            start_date = new Date(start_date);
            end_date = end_date.setHours(23, 59, 59, 999);
            end_date = new Date(end_date);

            let monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            week_start_date_view = start_date.getDate() + ' ' + monthNames[start_date.getMonth()] + ' ' + start_date.getFullYear();
            week_end_date_view = end_date.getDate() + ' ' + monthNames[end_date.getMonth()] + ' ' + end_date.getFullYear();
        }

        let number_of_rec = Number(req.body.limit);

        let lookup = {
            $lookup:
            {
                from: "partners",
                localField: "_id",
                pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1, unique_id: 1, phone: !req.headers.is_show_phone ?  HIDE_DETAILS.PHONE : 1, 
                    wallet_currency_code: 1, country_phone_code: !req.headers.is_show_phone ?  HIDE_DETAILS.COUNTRY_CODE : 1 } }],
                foreignField: "_id",
                as: "provider_detail"
            }
        };

        let country_filter = { "$match": {} };
        let city_filter = { "$match": {} };
        let timezone = '';

        if (selected_country !== 'all') {
            let country = await Country.findOne({ _id: Schema(selected_country) });
            if (country) {
                timezone = country.country_all_timezone[0];
            }
            country_filter['$match']['country_id'] = { $eq: Schema(selected_country) };
            if (selected_city !== 'all') {
                let city = await City.findOne({ _id: selected_city });
                if (city) {
                    timezone = city.timezone;
                }
                city_filter['$match']['city_id'] = { $eq: Schema(selected_city) };
            }
        }

        let value = search_value;
        let search = { "$match": {} };
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');
        if (search_item == "provider_detail.first_name") {
            let query1 = {};
            let query2 = {};
            let query4 = {};
            let query5 = {};

            let full_name = value.split(' ');
            if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['provider_detail.last_name'] = { $regex: new RegExp(value, 'i') };

                search = { "$match": { $or: [query1, query2] } };
            } else {

                query4['provider_detail.first_name'] = { $regex: new RegExp(full_name[0], 'i') };
                query5['provider_detail.last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                search = { "$match": { $and: [query4, query5] } };
            }
        } else {
            search["$match"][search_item] = { $regex: value };
        }

        let trip_filter = { "$match": {} };

        if(start_date && end_date) {
            const startDate = moment(start_date).startOf('day').toDate();
            const endDate = moment(end_date).endOf('day').toDate();
            trip_filter["$match"]['complete_date_in_city_timezone'] = { $gte: startDate, $lt: endDate };
        }

        let sort = {}
        let sort_item = req.body.sort_item 
        let sort_order = Number(req.body.sort_order)
        if(sort_item && sort_order){
            sort = {$sort:{
                [sort_item] : sort_order
            }}
        } else {
            sort = { $sort: { provider_trip_end_time: -1 } }
        }

        ///// For Count number of result /////
        let count = { $group: { _id: null, total: { $sum: 1 }, data: { $push: '$data' } } };

        //// For skip number of result /////
        let skip = {};
        skip["$skip"] = page * number_of_rec;

        ///// For limitation on result /////
        let limit = {};
        limit["$limit"] = number_of_rec;

        let trip_condition = { 'is_trip_completed': 1 };
        let trip_condition_new = { $and: [{ 'is_trip_cancelled_by_user': 1 }, { 'pay_to_provider': { $gt: 0 } }] };
        trip_condition = { $match: { $or: [trip_condition, trip_condition_new] } };
        
        let provider_type_condition = { $match: { 'provider_type': Number(constant_json.PROVIDER_TYPE_PARTNER) } };

        if (req.body.partner_id) {
            provider_type_condition = { $match: { $and: [{ 'provider_type': Number(constant_json.PROVIDER_TYPE_PARTNER) }, { provider_type_id: Schema(req.body.partner_id) }] } }
        }
        let provider_weekly_analytic_data = {};

        let trip_group_condition = {
            $group: {
                _id: '$provider_type_id',
                total_trip: { $sum: 1 },
                completed_trip: { $sum: { $cond: [{ $eq: ["$is_trip_completed", 1] }, 1, 0] } },
                card_payment: { $sum: '$card_payment' },
                cash_payment: { $sum: '$cash_payment' },
                wallet_payment: { $sum: '$wallet_payment' },
                total: { $sum: '$total' },
                provider_have_cash: { $sum: '$cash_payment' },
                provider_service_fees: { $sum: '$provider_service_fees' },
                pay_to_provider: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', false] }, { '$eq': ['$is_transfered', false] }] }, '$pay_to_provider', 0] } },
                remaining_payment:{$first:'$remaining_payment'},
                currency: {$first:'$currency'}

            }

        }

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.TRIP, req.headers)

        if (req.body.is_export) {
            let trips = await Trip_history.aggregate([{$match: country_city_condition}, trip_condition, trip_filter, provider_type_condition, country_filter, city_filter, trip_group_condition, lookup, search,sort])
            generate_partner_earning(req, res, trips, req.body.header)
            return
        }

        let trips = await Trip_history.aggregate([{$match: country_city_condition}, trip_condition, trip_filter, provider_type_condition, country_filter, city_filter, trip_group_condition, lookup, search,sort, count])

        if (trips.length == 0) {
            trips = [];
            return res.json({ 
                success: true, 
                detail: trips, 'current_page': 1, provider_weekly_analytic: provider_weekly_analytic_data, type: req.body.type, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, week_start_date_view: week_start_date_view, week_end_date_view: week_end_date_view, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date,is_show_email: req.headers.is_show_email, is_show_phone : req.headers.is_show_phone,
                success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                success_message: "",  
            });

        } else {
            let pages = Math.ceil(trips[0].total / number_of_rec);

            trips = await Trip_history.aggregate([{$match: country_city_condition}, trip_condition, trip_filter, provider_type_condition, country_filter, city_filter, trip_group_condition, lookup, search, sort, skip, limit])

            if (trips.length == 0) {
                trips = [];
                return res.json({ 
                    success: true, 
                    detail: trips, 'current_page': 1, provider_weekly_analytic: provider_weekly_analytic_data, type: req.body.type, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, week_start_date_view: week_start_date_view, week_end_date_view: week_end_date_view, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date, is_show_email: req.headers.is_show_email, is_show_phone : req.headers.is_show_phone,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: "",  
                });
            } else {

                let trip_group_condition_total = {
                    $group: {
                        _id: null,
                        total_trip: { $sum: 1 },
                        completed_trip: { $sum: { $cond: [{ $eq: ["$is_trip_completed", 1] }, 1, 0] } },
                        total: { $sum: '$total' },
                        promo_payment: { $sum: '$promo_payment' },
                        card_payment: { $sum: '$card_payment' },
                        cash_payment: { $sum: '$cash_payment' },
                        wallet_payment: { $sum: '$wallet_payment' },
                        admin_earning: { $sum: { $subtract: ['$total', '$provider_service_fees'] } },
                        admin_earning_in_currency: { $sum: { $subtract: ['$total_in_admin_currency', '$provider_service_fees_in_admin_currency'] } },
                        provider_earning: { $sum: '$provider_service_fees_in_admin_currency' },
                        provider_have_cash: { $sum: '$provider_have_cash' },
                        pay_to_provider: { $sum: '$pay_to_provider' },
                        remaining_payment:{$first:'$remaining_payment'},
                        currency: {$first:'$currency'}

                    }
                }

                let lookup1 = {
                    $lookup:
                    {
                        from: "partners",
                        localField: "provider_type_id",
                        foreignField: "_id",
                        pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1, unique_id: 1, phone: 1, wallet_currency_code: 1, country_phone_code: 1 } }],
                        as: "provider_detail"
                    }
                };

                let trip_total = await Trip_history.aggregate([{$match: country_city_condition}, lookup1, search,trip_condition, trip_filter, provider_type_condition, country_filter, city_filter, trip_group_condition_total])
                if (trip_total.length == 0) {
                    trips = [];
                    return res.json({ 
                        success: true,
                        detail: trips, 'current_page': 1, provider_weekly_analytic: provider_weekly_analytic_data, type: req.body.type, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, week_start_date_view: week_start_date_view, week_end_date_view: week_end_date_view, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date, is_show_email: req.headers.is_show_email, is_show_phone : req.headers.is_show_phone,
                        success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                        success_message: "",  
                    });
                } else {
                    return res.json({ 
                        success: true,
                        detail: trips, 'current_page': page, provider_weekly_analytic: provider_weekly_analytic_data, trip_total: trip_total, type: req.body.type, 'pages': pages, 'next': next, 'pre': pre, moment: moment, week_start_date_view: week_start_date_view, week_end_date_view: week_end_date_view, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date, is_show_email: req.headers.is_show_email, is_show_phone : req.headers.is_show_phone,
                        success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                        success_message: "",  
                    });
                }
            }
        }
    } catch (err) {
        utils.error_response(err, req, res)
    }

};

async function generate_partner_earning(req, res, array, header) {
    let setting_detail = await Settings.findOne({},{history_base_url: 1,timezone_for_display_date:1})
    const currentDate = moment().tz(setting_detail.timezone_for_display_date).format('HHmm_DDMMYYYY');
    let wb = new xl.Workbook();
    let ws = wb.addWorksheet('sheet1');
    let col = 1;
    let title = JSON.parse(header)
    ws.cell(1, col++).string(title.partner_id);
    ws.cell(1, col++).string(title.name);
    ws.cell(1, col++).string(title.phone);
    ws.cell(1, col++).string(title.total);
    ws.cell(1, col++).string(title.cash);
    ws.cell(1, col++).string(title.driver_profit);
    ws.cell(1, col++).string(title.pay_to_partner);

    array.forEach(function (data, index) {
        col = 1;
        if (data.provider_detail.length > 0) {
            ws.cell(index + 2, col++).number(data.provider_detail[0].unique_id);
            ws.cell(index + 2, col++).string(data.provider_detail[0].first_name + ' ' + data.provider_detail[0].last_name);
            ws.cell(index + 2, col++).string(data.provider_detail[0].country_phone_code + data.provider_detail[0].phone);
        } else {
            col += 3;
        }

        ws.cell(index + 2, col++).number(data.total);
        ws.cell(index + 2, col++).number(data.provider_have_cash);
        ws.cell(index + 2, col++).number(data.provider_service_fees);
        ws.cell(index + 2, col++).number(data.pay_to_provider);

        if (index == array.length - 1) {
            wb.write('data/xlsheet/' + "Partner_weekly_earning" + '_' + currentDate + '.xlsx', async function (err) {
                if (err) {
                    console.error(err);
                } else {                    
                    let url = setting_detail.history_base_url +"/xlsheet/" + "Partner_weekly_earning" + '_' + currentDate + '.xlsx';

                    if(res.json){
                        res.json(url);
                    }else{
                        res(url);
                    }

                    // Old Code:
                    // let url = req.protocol + "://" + req.get('host') + "/xlsheet/" + time + "_partner_weekly_earning.xlsx";
                    // res.json(url);
                    // setTimeout(function () {
                    //     fs.unlink('data/xlsheet/' + time + '_partner_weekly_earning.xlsx', function () {
                    //     });
                    // }, 10000)
                }
            });
        }
    })
}



exports.partner_weekly_earning_statement = async function (req, res) {
    try {
        let partner_id = req.body.partner_id;
        let start_date = new Date(req.body.week_start_date);
        let end_date = new Date(req.body.week_end_date);

        start_date = start_date.setHours(0, 0, 0, 0);
        start_date = new Date(start_date);
        end_date = end_date.setHours(23, 59, 59, 999);
        end_date = new Date(end_date);


        let provider_match_condition = { $match: { partner_id: { $eq: Schema(partner_id) } } };
        let provider_daily_analytic_data = [];

        let date_for_tag = new Date(start_date);
        for (let i = 0; i < 7; i++) {
            provider_daily_analytic_data.push(moment(date_for_tag).format(constant_json.DATE_FORMAT_MMM_D_YYYY));
            date_for_tag = moment(date_for_tag).add(1, 'days');
        }

        let provider_daily_analytic_query = { $match: { date_tag: { $in: provider_daily_analytic_data } } }
        let group_analytic_data_condition = {
            $group: {
                _id: null,
                received: { $sum: '$received' },
                accepted: { $sum: '$accepted' },
                rejected: { $sum: '$rejected' },
                not_answered: { $sum: '$not_answered' },
                cancelled: { $sum: '$cancelled' },
                completed: { $sum: '$completed' },
                acception_ratio: { $sum: '$acception_ratio' },
                rejection_ratio: { $sum: '$rejection_ratio' },
                cancellation_ratio: { $sum: '$cancellation_ratio' },
                completed_ratio: { $sum: '$completed_ratio' },
                total_online_time: { $sum: '$total_online_time' }
            }
        }

        let cond1 = { $match: { provider_type_id: { $eq: Schema(partner_id) } } }
        let proj1 = {
            $project: {
                _id: 1
            }
        }
        let partner_provider_list = await Provider.aggregate([cond1, proj1])
        let provider_ids = []
        partner_provider_list.forEach(provider => {
            provider_ids.push(provider._id)
        })
        provider_match_condition = { $match: { provider_id: { $in: provider_ids } } };

        let provider_daily_analytic = await Provider_daily_analytic.aggregate([provider_match_condition, provider_daily_analytic_query, group_analytic_data_condition])

        if (provider_daily_analytic.length > 0) {
            provider_daily_analytic_data = provider_daily_analytic[0];
            if ((Number(provider_daily_analytic_data.received)) > 0) {
                let received = provider_daily_analytic_data.received;
                provider_daily_analytic_data.acception_ratio = utils.precisionRoundTwo(Number((provider_daily_analytic_data.accepted * 100) / received));
                provider_daily_analytic_data.cancellation_ratio = utils.precisionRoundTwo(Number((provider_daily_analytic_data.cancelled * 100) / received));
                provider_daily_analytic_data.completed_ratio = utils.precisionRoundTwo(Number((provider_daily_analytic_data.completed * 100) / received));
                provider_daily_analytic_data.rejection_ratio = utils.precisionRoundTwo(Number((provider_daily_analytic_data.rejected * 100) / received));
            }
        }

        let provider_condition = { $match: { provider_type_id: { $eq: Schema(partner_id) } } };

        let filter = { "$match": {} };
        filter["$match"]['complete_date_in_city_timezone'] = { $gte: start_date, $lt: end_date };

        let trip_condition = { 'is_trip_completed': 1 };
        let trip_condition_new = { $and: [{ 'is_trip_cancelled_by_user': 1 }, { 'pay_to_provider': { $gt: 0 } }] };
        trip_condition = { $match: { $or: [trip_condition, trip_condition_new] } };

        let trip_group_condition = {
            $group: {
                _id: '$provider._id',
                total_distance: { $sum: '$total_distance' },
                total_time: { $sum: '$total_time' },
                total_waiting_time: { $sum: '$total_waiting_time' },
                total_service_surge_fees: { $sum: '$surge_fee' },
                service_total: { $sum: '$total_after_surge_fees' },
                total_cancellation_fees: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_trip_cancelled_by_user', 1] }, { '$gt': ['$pay_to_provider', 0] }] }, '$total_service_fees', 0] } },

                total_provider_tax_fees: { $sum: '$provider_tax_fee' },
                total_provider_miscellaneous_fees: { $sum: '$provider_miscellaneous_fee' },
                total_toll_amount: { $sum: '$toll_amount' },
                total_tip_amount: { $sum: '$tip_amount' },
                total_provider_service_fees: { $sum: '$provider_service_fees' },

                total_provider_have_cash: { $sum: { '$cond': [{ '$eq': ['$payment_mode', 1] }, '$cash_payment', 0] } },
                total_deduct_wallet_amount: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', true] }, { '$ne': ['$is_provider_earning_added_in_wallet', true] }, { '$eq': ['$payment_mode', 1] }] }, '$provider_income_set_in_wallet', 0] } },
                                total_added_wallet_amount: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', true] }, {$or: [{ '$eq': ['$is_provider_earning_added_in_wallet', true] }, { '$eq': ['$payment_mode', 0] } ]} ] }, '$provider_income_set_in_wallet', 0] } },
                                total_paid_in_wallet_payment: { $sum: { '$cond': [{ '$eq': ['$is_provider_earning_set_in_wallet', true] }, '$provider_income_set_in_wallet', 0] } },
                total_transferred_amount: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', false] }, { '$eq': ['$is_transfered', true] }] }, '$pay_to_provider', 0] } },
                total_pay_to_provider: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', false] }, { '$eq': ['$is_transfered', false] }] }, '$pay_to_provider', 0] } },

                currency: { $first: '$currency' },
                unit: { $first: '$unit' },
                created_at:{ $first: '$created_at'},
                statement_number: { $first: '$invoice_number' },
            }
        }
        let trips = await Trip_history.aggregate([provider_condition, trip_condition, filter, trip_group_condition])

        if (trips.length == 0) {
            trips = {};
            res.json({ sucess: true, detail: trips, type: req.body.type, provider_daily_analytic_data: provider_daily_analytic_data, moment: moment });
        } else {
            res.json({ sucess: true, detail: trips[0], type: req.body.type, provider_daily_analytic_data: provider_daily_analytic_data, moment: moment });
        }



    } catch (err) {
        utils.error_response(err, req, res)
    }
};


exports.statement_provider_trip_earning = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({})
        let params_trips = [{ name: "trip_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_trips)
        if (!response.success) {
            res.json(response)
            return;
        }
        let timezone_for_display_date = setting_detail.timezone_for_display_date;
        let query = { $match: {} };
        query["$match"]['_id'] = { $eq: Schema(req.body.trip_id) }


        let user_lookup = {
            $lookup: {
                from: 'users',
                localField: 'user_id',
                foreignField: '_id',
                pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1, unique_id: 1 } }],
                as: 'user_detail'
            }
        }
        let user_unwind = {
            $unwind: {
                path: "$user_detail",
                preserveNullAndEmptyArrays: true
            }
        };
        let Trip_service_lookup = {
            $lookup: {
                from: 'trip_services',
                localField: 'trip_service_city_type_id',
                foreignField: '_id',
                as: 'trip_service_detail'
            }
        }
        let Trip_service_unwind = {
            $unwind: {
                path: "$trip_service_detail",
                preserveNullAndEmptyArrays: true
            }
        };
        let city_type_lookup = {
            $lookup: {
                from: 'city_types',
                localField: 'service_type_id',
                foreignField: '_id',
                as: 'city_type_detail'
            }
        }
        let city_type_unwind = {
            $unwind: {
                path: "$city_type_detail",
                preserveNullAndEmptyArrays: true
            }
        };
        let Type_lookup = {
            $lookup: {
                from: 'types',
                localField: 'typeid',
                foreignField: '_id',
                as: 'type_detail'
            }
        }
        let Type_unwind = {
            $unwind: {
                path: "$type_detail",
                preserveNullAndEmptyArrays: true
            }
        };
        let provider_lookup = {
            $lookup: {
                from: 'providers',
                localField: 'current_provider',
                foreignField: '_id',
                pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1, unique_id: 1 } }],
                as: 'providers_detail'
            }
        }
        let provider_unwind = {
            $unwind: {
                path: "$providers_detail",
                preserveNullAndEmptyArrays: true
            }
        };
        let trip = await Trip_history.aggregate([query, user_lookup, user_unwind, Trip_service_lookup, Trip_service_unwind, city_type_lookup, city_type_unwind, Type_lookup, Type_unwind, provider_lookup, provider_unwind]);
        if (!trip) {
            trip = await Trip.aggregate([query, user_lookup, user_unwind, Trip_service_lookup, Trip_service_unwind, city_type_lookup, city_type_unwind, Type_lookup, Type_unwind, provider_lookup, provider_unwind]);
        }
        let rental_package;
        if (trip.car_rental_id) {
            rental_package = await City_type.findById(trip.car_rental_id);
        }
        res.json({ success: true, rental_package, detail: trip, type: req.body.type, timezone_for_display_date: timezone_for_display_date, provider_detail: "$providers_detail", user_detail: "$user_detail", type_detail: "$type_detail", service_detail: "$city_type_detail", moment: moment, tripservice: "$trip_service_detail" });
    } catch (err) {
        utils.error_response(err, req, res)
    }
}


exports.statement_provider_daily_and_weekly_earning = async function (req, res) {
    try {
        let params_trips = [{ name: "provider_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_trips)
        if (!response.success) {
            res.json(response)
            return;
        }

        let provider_id = req.body.provider_id
        let start_date = new Date(req.body.start_date);
        let end_date = new Date(req.body.end_date);

        let provider_match_condition = { $match: { provider_id: { $eq: Schema(provider_id) } } };
        let provider_daily_analytic_data = [];
        let timeDiff = end_date.getTime() - start_date.getTime();
        let dayDiff = timeDiff / (1000 * 3600 * 24);
        dayDiff = Math.ceil(dayDiff);
        let date_for_tag = new Date(start_date);
        let date_string = '';
        for (let i = 0; i <= dayDiff; i++) {
            if (i == 0) {
                date_string = date_string + moment(date_for_tag).format(constant_json.DATE_FORMAT_MMM_D_YYYY)
            }
            if (i == dayDiff - 1) {
                date_string = date_string + ' - ' + moment(date_for_tag).format(constant_json.DATE_FORMAT_MMM_D_YYYY)
            }
            provider_daily_analytic_data.push(moment(date_for_tag).format(constant_json.DATE_FORMAT_MMM_D_YYYY));
            date_for_tag = moment(date_for_tag).add(1, 'days');
        }

        start_date = start_date.setHours(0, 0, 0, 0);
        start_date = new Date(start_date);
        end_date = end_date.setHours(23, 59, 59, 999);
        end_date = new Date(end_date);

        let provider_daily_analytic_query = { $match: { date_tag: { $in: provider_daily_analytic_data } } }
        let group_analytic_data_condition = {
            $group: {
                _id: null,
                received: { $sum: '$received' },
                accepted: { $sum: '$accepted' },
                rejected: { $sum: '$rejected' },
                not_answered: { $sum: '$not_answered' },
                cancelled: { $sum: '$cancelled' },
                completed: { $sum: '$completed' },
                acception_ratio: { $sum: '$acception_ratio' },
                rejection_ratio: { $sum: '$rejection_ratio' },
                cancellation_ratio: { $sum: '$cancellation_ratio' },
                completed_ratio: { $sum: '$completed_ratio' },
                total_online_time: { $sum: '$total_online_time' }
            }
        }
        let provider_daily_analytic = await Provider_daily_analytic.aggregate([provider_match_condition, provider_daily_analytic_query, group_analytic_data_condition])


        if (provider_daily_analytic.length > 0) {
            provider_daily_analytic_data = provider_daily_analytic[0];
            if ((Number(provider_daily_analytic_data.received)) > 0) {
                let received = provider_daily_analytic_data.received;
                provider_daily_analytic_data.acception_ratio = utils.precisionRoundTwo(Number((provider_daily_analytic_data.accepted * 100) / received));
                provider_daily_analytic_data.cancellation_ratio = utils.precisionRoundTwo(Number((provider_daily_analytic_data.cancelled * 100) / received));
                provider_daily_analytic_data.completed_ratio = utils.precisionRoundTwo(Number((provider_daily_analytic_data.completed * 100) / received));
                provider_daily_analytic_data.rejection_ratio = utils.precisionRoundTwo(Number((provider_daily_analytic_data.rejected * 100) / received));
            }
        }

        let provider_condition = { $match: { provider_id: { $eq: Schema(provider_id) } } };

        let filter = { "$match": {} };
        filter["$match"]['complete_date_in_city_timezone'] = { $gte: start_date, $lt: end_date };
        let trip_condition1 = { 'is_trip_completed': 1 };
        let trip_condition2 = { $and: [{ 'is_trip_cancelled_by_user': 1 }, { 'pay_to_provider': { $gt: 0 } }] };

        let trip_condition = { $match: { $or: [trip_condition1, trip_condition2] } };

        let trip_group_condition = {
            $group: {
                _id: '$provider_id',
                total_distance: { $sum: '$total_distance' },
                total_time: { $sum: '$total_time' },
                total_waiting_time: { $sum: '$total_waiting_time' },
                total_service_surge_fees: { $sum: '$surge_fee' },
                service_total: { $sum: '$total_after_surge_fees' },

                total_provider_tax_fees: { $sum: '$provider_tax_fee' },
                total_provider_miscellaneous_fees: { $sum: '$provider_miscellaneous_fee' },
                total_toll_amount: { $sum: '$toll_amount' },
                total_tip_amount: { $sum: '$tip_amount' },
                total_provider_service_fees: { $sum: '$provider_service_fees' },

                total_provider_have_cash: { $sum: { '$cond': [{ '$eq': ['$payment_mode', 1] }, '$cash_payment', 0] } },
                total_deduct_wallet_amount: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', true] }, { '$ne': ['$is_provider_earning_added_in_wallet', true] }, { '$eq': ['$payment_mode', 1] }] }, '$provider_income_set_in_wallet', 0] } },           
                                total_added_wallet_amount: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', true] }, {$or: [{ '$eq': ['$is_provider_earning_added_in_wallet', true] }, { '$eq': ['$payment_mode', 0] } ]} ] }, '$provider_income_set_in_wallet', 0] } },
                                total_paid_in_wallet_payment: { $sum: { '$cond': [{ '$eq': ['$is_provider_earning_set_in_wallet', true] }, '$provider_income_set_in_wallet', 0] } },

                total_transferred_amount: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', false] }, { '$eq': ['$is_transfered', true] }] }, '$pay_to_provider', 0] } },
                total_pay_to_provider: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', false] }, { '$eq': ['$is_transfered', false] }] }, '$pay_to_provider', 0] } },

                currency: { $first: '$currency' },
                date: { $first: '$provider_trip_end_time' },
                unit: { $first: '$unit' },
                statement_number: { $first: '$invoice_number' },
            }
        }

        let trips = await Trip_history.aggregate([provider_condition, trip_condition, filter, trip_group_condition,])
        if (trips.length == 0) {
            trips = [];
            res.json({ success: true, detail: trips, trips: trips, date_string: date_string, provider_daily_analytic_data: provider_daily_analytic_data, moment: moment });

        } else {
            let trip = await Trip_history.aggregate([provider_condition, trip_condition, filter])
            res.json({ success: true, detail: trips[0], date_string: date_string, trips: trip, provider_daily_analytic_data: provider_daily_analytic_data, moment: moment });

        }
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.wallet_history = async function (req, res){
    let params_array = []
    let response = await utils.check_request_params_async(req.query, params_array)
    if (!response.success) {
        res.json(response)
        return;
    }
    if (req.body.is_excel_sheet) {
        req.body.host = req.get('host')
        req.body.protocol = req.protocol

        let request = {
            query: req.body,
            headers: {
                is_show_email: req.headers.is_show_email,
                is_show_phone: req.headers.is_show_phone,
            }
        }

        
        queue_manager.walletHistoryQueue.add(request,{
            jobId: Date.now()
        }).then((job) => {
            let export_history = new Export_history({
                type: TRIP_LIST.WALLET_HISTORY,
                status: EXPORT_HISTORY_STATUS.QUEUED,
                unique_id: job.id,
                export_user_id: request.query.export_user_id,
                data: job.data
            })
            export_history.save();
            return res.json({ 
                success: true,
                success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                success_message: ""  
            });
        });
        return;
    }
    mExportDataController.get_wallet_history_data(req, res);
}

//admin wakket history
exports.get_wallet_history_data = async function (req, res) {
    if(!req.body){
        req.body = req.query;
    }
    try {
        const setting_detail = await Settings.findOne({})
        let page;
        let next;
        let pre;
        let search_item;
        let search_value;
        let sort_order = -1;
        let sort_field = 'unique_id';
        let filter_start_date = '';
        let filter_end_date = '';
        let value
        if (req.body.page == undefined) {
            page = 0;
            next = 1;
            pre = 0;
        } else {
            page = req.body.page;
            next = parseInt(req.body.page) + 1;
            pre = req.body.page - 1;
        }

        if (req.body.search_item == undefined) {
            search_item = 'wallet_description';
            search_value = '';

        } else {
            value = req.body.search_value;
            value = value.trim();
            value = value.replace(/ +(?= )/g, '');
            value = new RegExp(value, 'i');

            search_item = req.body.search_item
            search_value = req.body.search_value;
        }
        if (req.body.sort_order && req.body.sort_order != undefined) {
            sort_order = req.body.sort_order;
        }
        if (req.body.sort_item || req.body.sort_item != undefined) {
            sort_field = req.body.sort_item;
        }
        if (req.body.start_date && req.body.start_date != undefined) {
            filter_start_date = req.body.start_date;
        }
        if (req.body.end_date && req.body.end_date != undefined) {
            filter_end_date = req.body.end_date;
        }

        let start_date = req.body.start_date;
        let end_date = req.body.end_date;
        let number_of_rec = req.body.limit;

        let lookup = {
            $lookup:
            {
                from: "users",
                localField: "user_id",
                pipeline: [{ $project: { 
                    _id: 1, 
                    email: !req.headers.is_show_email ?  HIDE_DETAILS.EMAIL : 1,
                    unique_id: 1, 
                    wallet_currency_code: 1 } }],
                foreignField: "_id",
                as: "user_detail"
            }
        };

        let lookup1 = {
            $lookup:
            {
                from: "providers",
                localField: "user_id",
                pipeline: [{ $project: { _id: 1, email: !req.headers.is_show_email ?  HIDE_DETAILS.EMAIL : 1, unique_id: 1, wallet_currency_code: 1 } }],
                foreignField: "_id",
                as: "provider_detail"
            }
        };

        let lookup2 = {
            $lookup:
            {
                from: "partners",
                localField: "user_id",
                pipeline: [{ $project: { _id: 1, email: !req.headers.is_show_email ?  HIDE_DETAILS.EMAIL : 1, unique_id: 1, wallet_currency_code: 1 } }],
                foreignField: "_id",
                as: "partner_detail"
            }
        };

        let lookup3 = {
            $lookup:
            {
                from: "corporates",
                localField: "user_id",
                pipeline: [{ $project: { _id: 1, email: !req.headers.is_show_email ?  HIDE_DETAILS.EMAIL : 1, unique_id: 1, wallet_currency_code: 1 } }],
                foreignField: "_id",
                as: "corporate_detail"
            }
        };
        value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');

        let type_condition = {$match:{}}
        let type_value = req.body.type

        if(type_value != 0){
            type_condition['$match']['user_type'] = Number(type_value)
        }

        let search = { "$match": {} };
        if(search_value){
            search["$match"][search_item] = { $regex: new RegExp(value, 'i') }
            if(search_item == 'email'){
                search = {
                    $match:{
                        $or:[
                            {
                                'user_detail.email': { $regex: new RegExp(value, 'i') }
                            },
                            {
                                'provider_detail.email': { $regex: new RegExp(value, 'i') }
                            },
                            {
                                'partner_detail.email': { $regex: new RegExp(value, 'i') }
                            },
                            {
                                'corporate_detail.email': { $regex: new RegExp(value, 'i') }
                            }
                        ]
                    }
                }
            }
        }
      
        let filter = { "$match": {} };

        if(start_date && end_date) {
            const startDate = moment(start_date).startOf('day').toDate();
            const endDate = moment(end_date).endOf('day').toDate();
            filter["$match"]['created_at'] = { $gte: startDate, $lt: endDate };
        }

        let sort = {};
        if (sort_field && sort_order) {
            sort = {
                $sort: {
                    [sort_field]: parseInt(sort_order)
                }
            }
        }

        let count = { $group: { _id: null, total: { $sum: 1 }, data: { $push: '$data' } } };

        let skip = {};
        skip["$skip"] = page * number_of_rec;

        let limit = {};
        limit["$limit"] = number_of_rec;

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.WALLET_HISTORY, req.headers)

        if (req.body.is_excel_sheet) {
            let trips = await Wallet_history.aggregate([{$match: country_city_condition}, type_condition, lookup, lookup1, lookup2, lookup3, search, filter])
            wallet_excel(req, res, trips, req.body.header)
            return
        }

        let wallet_history = await Wallet_history.aggregate([{$match: country_city_condition}, type_condition, lookup, lookup1, lookup2, lookup3, search, filter, count])
        
        if (wallet_history.length == 0) {
            if(res.json){
                return res.json({ 
                    success: true,
                    detail: wallet_history, 'current_page': 1, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date, is_show_email: req.headers.is_show_email, is_show_phone : req.headers.is_show_phone, 
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: "",  
                });
            }else{
                res({ 
                    success: true,
                    detail: wallet_history, 'current_page': 1, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date, is_show_email: req.headers.is_show_email, is_show_phone : req.headers.is_show_phone,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: "",  
                });
            }
        } else {
            let is_public_demo = setting_detail.is_public_demo;

            let pages = Math.ceil(wallet_history[0].total / number_of_rec);
            wallet_history = await Wallet_history.aggregate([{$match: country_city_condition}, type_condition, lookup, lookup1, lookup2, lookup3, search, filter, sort, skip, limit])

            if(res.json){
                res.json({ 
                    success: true,
                    is_public_demo: is_public_demo, timezone_for_display_date: setting_detail.timezone_for_display_date, detail: wallet_history, 'current_page': page, 'pages': pages, 'next': next, 'pre': pre, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date, is_show_email: req.headers.is_show_email, is_show_phone : req.headers.is_show_phone,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: "",  
                });
            }else{
                res({ 
                    success: true,
                    is_public_demo: is_public_demo, timezone_for_display_date: setting_detail.timezone_for_display_date, detail: wallet_history, 'current_page': page, 'pages': pages, 'next': next, 'pre': pre, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date, is_show_email: req.headers.is_show_email, is_show_phone : req.headers.is_show_phone, 
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: "",  
                });
            }
            
            delete message;
        }

    } catch (err) {
        utils.error_response(err, req, res)
    }
};

function wallet_excel(req, res, array, header) {
    let date = new Date()
    let time = date.getTime()
    let wb = new xl.Workbook();
    let ws = wb.addWorksheet('sheet1');
    let col = 1;

    let title
    if(header){
        title = JSON.parse(header)
    }else{
        title = {
            id : "ID",
            type : "Type",
            date : "Date",
            email : "Email",
            currency : "Currency",
            wallet_amount : "Wallet Amount",
            add_cut : "Add/Cut",
            wallet : "Wallet",
            from_where : "From where",
            user: "User",
            provider: "Driver",
            partner: "Partner",
            corporate: "Corporate",
        }
    }

    ws.cell(1, col++).string(title.id);
    ws.cell(1, col++).string(title.type);
    ws.cell(1, col++).string(title.date);
    ws.cell(1, col++).string(title.email);
    ws.cell(1, col++).string(title.currency);
    ws.cell(1, col++).string(title.wallet_amount);
    ws.cell(1, col++).string(title.add_cut);
    ws.cell(1, col++).string(title.wallet);
    ws.cell(1, col++).string(title.from_where);

    array.forEach(function (data, index) {
        col = 1;
        ws.cell(index + 2, col++).number(data.unique_id);
        if (data.user_type == constant_json.USER_UNIQUE_NUMBER) {
            ws.cell(index + 2, col++).string(title.user);
        } else if (data.user_type == constant_json.PROVIDER_UNIQUE_NUMBER) {
            ws.cell(index + 2, col++).string(title.provider);
        } else if (data.user_type == constant_json.PARTNER_UNIQUE_NUMBER) {
            ws.cell(index + 2, col++).string(title.partner);
        }
        ws.cell(index + 2, col++).string(moment(data.created_at).format("DD MMM 'YY") + ' ' + moment(data.created_at).format("hh:mm a"));

        if (data.user_type == constant_json.USER_UNIQUE_NUMBER) {
            if (data.user_detail.length > 0) {
                ws.cell(index + 2, col++).string(data.user_detail[0].email);
            } else {
                col+=3;
            }
        } else if (data.user_type == constant_json.PROVIDER_UNIQUE_NUMBER) {
            if (data.provider_detail.length > 0) {
                ws.cell(index + 2, col++).string(data.provider_detail[0].email);
            } else {
                col+=3;
            }
        } else if (data.user_type == constant_json.PARTNER_UNIQUE_NUMBER) {
            if (data.partner_detail.length > 0) {
                ws.cell(index + 2, col++).string(data.partner_detail[0].email);
            } else {
                col+=3;
            }
        }else if (data.user_type == constant_json.CORPORATE_UNIQUE_NUMBER) {
            if (data.partner_detail.length > 0) {
                ws.cell(index + 2, col++).string(data.corporate_detail[0].email);
            } else {
                col+=3;
            }
        }

        if (data.user_type == constant_json.USER_UNIQUE_NUMBER) {
            if (data.user_detail.length > 0) {
                ws.cell(index + 2, col++).string(data.user_detail[0].wallet_currency_code);
            } else {
                col++;
            }
        } else if (data.user_type == constant_json.PROVIDER_UNIQUE_NUMBER) {
            if (data.provider_detail.length > 0) {
                ws.cell(index + 2, col++).string(data.provider_detail[0].wallet_currency_code);
            } else {
                col++;
            }
        } else if (data.user_type == constant_json.PARTNER_UNIQUE_NUMBER) {
            if (data.partner_detail.length > 0) {
                ws.cell(index + 2, col++).string(data.partner_detail[0].wallet_currency_code);
            } else {
                col++;
            }
        }
        ws.cell(index + 2, col++).number(data.wallet_amount);

        if(data.wallet_status == +constant_json.DEDUCT_WALLET_AMOUNT){
            ws.cell(index + 2, col++).number(data.added_wallet).style({font: {color: "FF0000"}});
        }else{
            ws.cell(index + 2, col++).number(data.added_wallet).style({font: {color: "92D050"}});
        }
        ws.cell(index + 2, col++).number(data.total_wallet_amount);
        ws.cell(index + 2, col++).string(data.wallet_description);

        if (index == array.length - 1) {
            wb.write('data/xlsheet/Wallet_history_'+ time + '.xlsx', function (err) {
                if (err) {
                    console.error(err);
                } else {
                    let url = setting_detail.history_base_url + "/xlsheet/Wallet_history_"+ time + ".xlsx";
                    if(res.json){
                        res.json(url);
                    }else{
                        res(url);
                    }
                }
            });
        }
    });
}


// admin redeem_point_history
exports.redeem_point_history = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({})
        let page;
        let next;
        let pre;
        let search_item;
        let search_value;
        let sort_order = -1;
        let sort_field = 'unique_id';
        let filter_start_date = '';
        let filter_end_date = '';
        let value;
        if (req.body.page == undefined) {
            page = 0;
            next = 1;
            pre = 0;
        } else {
            page = req.body.page;
            next = parseInt(req.body.page) + 1;
            pre = req.body.page - 1;
        }

        if (req.body.search_item == undefined) {
            search_item = 'redeem_point_description';
            search_value = '';

        } else {
            value = req.body.search_value;
            value = value.trim();
            value = value.replace(/ +(?= )/g, '');
            value = new RegExp(value, 'i');

            search_item = req.body.search_item
            search_value = req.body.search_value;
        }
        if (req.body.sort_order && req.body.sort_order != undefined) {
            sort_order = req.body.sort_order;
        }
        if (req.body.sort_item || req.body.sort_item == undefined) {
            sort_field = req.body.sort_item;
        }
        if (req.body.start_date && req.body.start_date != undefined) {
            filter_start_date = req.body.start_date;
        }
        if (req.body.end_date && req.body.end_date != undefined) {
            filter_end_date = req.body.end_date;
        }
       
        let end_date = req.body.end_date;
        let start_date = req.body.start_date;
        let number_of_rec = req.body.limit;

        let lookup = {
            $lookup:
            {
                from: "users",
                localField: "user_id",
                pipeline: [{ $project: { 
                    _id: 1, 
                    email: !req.headers.is_show_email ?  HIDE_DETAILS.EMAIL : 1,
                    unique_id: 1, 
                    wallet_currency_code: 1 } }],
                foreignField: "_id",
                as: "user_detail"
            }
        };

        let lookup1 = {
            $lookup:
            {
                from: "providers",
                localField: "user_id",
                pipeline: [{ $project: { _id: 1, email: !req.headers.is_show_email ?  HIDE_DETAILS.EMAIL : 1, unique_id: 1, wallet_currency_code: 1 } }],
                foreignField: "_id",
                as: "provider_detail"
            }
        };

        let lookup2 = {
            $lookup:
            {
                from: "partners",
                localField: "user_id",
                pipeline: [{ $project: { _id: 1, email: !req.headers.is_show_email ?  HIDE_DETAILS.EMAIL : 1, unique_id: 1, wallet_currency_code: 1 } }],
                foreignField: "_id",
                as: "partner_detail"
            }
        }

        value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');

        let type_condition = {$match:{}}
        let type_value = req.body.type

        if(type_value != 0){
            type_condition['$match']['user_type'] = Number(type_value)
        }

        let search = { "$match": {} };
        if(search_value){
            search["$match"][search_item] = { $regex: new RegExp(value, 'i') }
            if(search_item == 'email'){
                search = {
                    $match:{
                        $or:[
                            {
                                'user_detail.email': { $regex: new RegExp(value, 'i') }
                            },
                            {
                                'provider_detail.email': { $regex: new RegExp(value, 'i') }
                            },
                            {
                                'partner_detail.email': { $regex: new RegExp(value, 'i') }
                            },
                        ]
                    }
                }
            }
        }
      
        let filter = { "$match": {} };

        if(start_date && end_date) {
            const startDate = moment(start_date).startOf('day').toDate();
            const endDate = moment(end_date).endOf('day').toDate();
            filter["$match"]['created_at'] = { $gte: startDate, $lt: endDate };
        }

        let sort = { "$sort": {unique_id:-1} };
        if(sort_field && sort_order){
            sort["$sort"][sort_field] = parseInt(sort_order);
        }

        let count = { $group: { _id: null, total: { $sum: 1 }, data: { $push: '$data' } } };

        let skip = {};
        skip["$skip"] = page * number_of_rec;

        let limit = {};
        limit["$limit"] = number_of_rec;

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.WALLET_HISTORY, req.headers)

        if (req.body.is_export) {
            let trips = await Redeem_point_history.aggregate([{$match: country_city_condition}, type_condition, lookup, lookup1,lookup2, search, filter])
            wallet_excel(req, res, trips)
            return
        }

        let wallet_history = await Redeem_point_history.aggregate([{$match: country_city_condition}, type_condition, lookup, lookup1,lookup2, search, filter, count])
        
        if (wallet_history.length == 0) {
            return res.json({ 
                success: true,
                detail: wallet_history, 'current_page': 1, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date, 
                success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                success_message: "",  
            });
        } else {
            let is_public_demo = setting_detail.is_public_demo;

            let pages = Math.ceil(wallet_history[0].total / number_of_rec);
            wallet_history = await Redeem_point_history.aggregate([{$match: country_city_condition}, type_condition, lookup, lookup1,lookup2, search, filter, sort, skip, limit])

            return res.json({ 
                success: true,
                is_public_demo: is_public_demo, timezone_for_display_date: setting_detail.timezone_for_display_date, detail: wallet_history, 'current_page': page, 'pages': pages, 'next': next, 'pre': pre, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date, 
                success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                success_message: "",  
            });
        }

    } catch (err) {
        console.log(err);
        utils.error_response(err, req, res)
    }
};


//admin transaction history
exports.transaction_history = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({})
        let page;
        let next;
        let pre;
        let search_item;
        let search_value;
        let sort_order = -1;
        let sort_field = 'unique_id';
        let filter_start_date = '';
        let filter_end_date = '';
        let value;
        if (req.body.page == undefined) {
            page = 0;
            next = 1;
            pre = 0;
        } else {
            page = Number(req.body.page);
            next = parseInt(req.body.page) + 1;
            pre = req.body.page - 1;
        }

        if (req.body.search_item == undefined) {
            search_item = '';
            search_value = '';
        } else {
            value = req.body.search_value;
            value = value.trim();
            value = value.replace(/ +(?= )/g, '');
            value = new RegExp(value, 'i');
            search_item = req.body.search_item
            search_value = req.body.search_value;
        }
        if (req.body.sort_order && req.body.sort_order != undefined) {
            sort_order = req.body.sort_order;
        }
        if (req.body.sort_item || req.body.sort_item == undefined) {
            sort_field = req.body.sort_item;
        }
        if (req.body.start_date && req.body.start_date != undefined) {
            filter_start_date = req.body.start_date;
        }
        if (req.body.end_date && req.body.end_date != undefined) {
            filter_end_date = req.body.end_date;
        }

        let end_date = req.body.end_date;
        let start_date = req.body.start_date;
        let number_of_rec = Number(req.body.limit);

        let lookup1 = {
            $lookup:
            {
                from: "providers",
                localField: "user_id",
                pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1, unique_id: 1,email: !req.headers.is_show_email ?  HIDE_DETAILS.EMAIL : 1, phone: !req.headers.is_show_phone ?  HIDE_DETAILS.PHONE : 1, wallet_currency_code: 1, country_phone_code: !req.headers.is_show_phone ?  HIDE_DETAILS.COUNTRY_CODE : 1 } }],
                foreignField: "_id",
                as: "provider_detail"
            }
        };

        let lookup2 = {
            $lookup:
            {
                from: "partners",
                localField: "user_id",
                pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1, unique_id: 1,email: !req.headers.is_show_email ?  HIDE_DETAILS.EMAIL : 1, phone: !req.headers.is_show_phone ?  HIDE_DETAILS.PHONE : 1, wallet_currency_code: 1, country_phone_code: !req.headers.is_show_phone ?  HIDE_DETAILS.COUNTRY_CODE : 1 } }],
                foreignField: "_id",
                as: "partner_detail"
            }
        };

        value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');


        let search = { "$match": {} };
        search["$match"][search_item] = { $regex: new RegExp(value, 'i') }


        let filter = { "$match": {} };
        if(start_date && end_date) {
            const startDate = moment(start_date).startOf('day').toDate();
            const endDate = moment(end_date).endOf('day').toDate();
            filter["$match"]['created_at'] = { $gte: startDate, $lt: endDate };
        }

        let sort = { "$sort": {} };
        sort["$sort"][sort_field] = parseInt(sort_order);

        let count = { $group: { _id: null, total: { $sum: 1 }, data: { $push: '$data' } } };

        let skip = {};
        skip["$skip"] = page * number_of_rec;

        let limit = {};
        limit["$limit"] = number_of_rec;

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.TRANSFER_HISTORY, req.headers)

        if(req.body.is_export){
            let transfer_history = await Transfer_history.aggregate([{$match: country_city_condition}, lookup1, lookup2, search, filter, sort])
            transfer_history(req,res,transfer_history)
            return
        }
        
        let transfer_history = await Transfer_history.aggregate([{$match: country_city_condition}, lookup1, lookup2, search, filter, count])

        if (transfer_history.length == 0) {
            return res.json({ 
                success: true,
                detail: transfer_history, 'current_page': 1, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date, is_show_email: req.headers.is_show_email, is_show_phone : req.headers.is_show_phone, 
                success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                success_message: "",
            });
        }
        else {
            let is_public_demo = setting_detail.is_public_demo;
            let pages = Math.ceil(transfer_history[0].total / number_of_rec);
            transfer_history = await Transfer_history.aggregate([{$match: country_city_condition}, lookup1, lookup2, search, filter, sort, skip, limit])
            return res.json({ 
                success: true,
                is_public_demo: is_public_demo, timezone_for_display_date: setting_detail.timezone_for_display_date, detail: transfer_history, 'current_page': page, 'pages': pages, 'next': next, 'pre': pre, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date, is_show_email: req.headers.is_show_email, is_show_phone : req.headers.is_show_phone,
                success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                success_message: "",
            });
        }
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

//corporate wakket history
exports.wallet_history_in_corporate = async function (req,res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let corporate_id = req.body.corporate_id
        let wallet_details = await Wallet_history.find({user_id:corporate_id})
        return res.json({ 
            success: true, wallet_history: wallet_details,
            success_code: String(success_messages.MESSAGE_CODE_WALLET_HISTORY_GET_SUCCESSFULLY),
            success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_WALLET_HISTORY_GET_SUCCESSFULLY),  
        });
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

// get_wallet_history
exports.get_wallet_history = function (req, res) {
    utils.check_request_params(req.body, [{name: 'user_id', type: 'string'}], function (response) {
        if (response.success) {
            let type = Number(req.body.type);
            let Table;
            switch (type) {
                case Number(constant_json.PROVIDER_UNIQUE_NUMBER):
                    type = Number(constant_json.PROVIDER_UNIQUE_NUMBER);
                    Table = Provider;
                    break;
                case Number(constant_json.PARTNER_UNIQUE_NUMBER):
                    type = Number(constant_json.PARTNER_UNIQUE_NUMBER);
                    Table = Partner;
                    break;
                default:
                    type = Number(constant_json.USER_UNIQUE_NUMBER);
                    Table = User;
                    break;
            }

            Table.findOne({_id: req.body.user_id}).then((detail) => {
                if (detail) {
                    if (req.body.token !== null && detail.token !== req.body.token) {
                        return res.json({ 
                            success: false,
                            error_code: String(error_message.ERROR_CODE_INVALID_TOKEN),
                            error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_INVALID_TOKEN),
                        });
                    } else {
                        Wallet_history.find({
                            user_id: req.body.user_id,
                            user_type: type
                        }, null, {sort: {'unique_id': -1}}).then((wallet_history) => {
                            if (wallet_history.length == 0) {
                                return res.json({ 
                                    success: false,
                                    error_code: String(error_message.ERROR_CODE_WALLET_HISTORY_NOT_FOUND),
                                    error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_WALLET_HISTORY_NOT_FOUND),
                                });
                            } else {
                                return res.json({ 
                                    success: true,
                                    success_code: String(success_messages.MESSAGE_CODE_WALLET_HISTORY_GET_SUCCESSFULLY),
                                    success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_WALLET_HISTORY_GET_SUCCESSFULLY),
                                    wallet_history: wallet_history 
                                });
                            }
                        });
                    }
                }
            });
        } else {
            return res.json({ 
                success: false,
                error_code: String(response.error_code),
                error_message: response.error_message,
            });
        }
    });
};

// get_redeem_point_history
exports.get_redeem_point_history =  function  (req, res) {
    utils.check_request_params(req.body, [{name: 'user_id', type: 'string'}],function (response) {
        if (response.success) {
            let type = Number(req.body.type);
            let Table;
            switch (type) {
                case Number(constant_json.USER_UNIQUE_NUMBER):
                    type = Number(constant_json.USER_UNIQUE_NUMBER);
                    Table = User;
                    break;
                case Number(constant_json.PROVIDER_UNIQUE_NUMBER):
                    type = Number(constant_json.PROVIDER_UNIQUE_NUMBER);
                    Table = Provider;
                    break;
                case Number(constant_json.PARTNER_UNIQUE_NUMBER):
                    type = Number(constant_json.PARTNER_UNIQUE_NUMBER);
                    Table = Partner;
                    break;
                default:
                    type = Number(constant_json.USER_UNIQUE_NUMBER);
                    Table = User
                    break;
            }
            Table.findOne({_id: req.body.user_id}).then(async(detail) => {
                if (detail) {
                    if (req.body.token !== null && detail.token !== req.body.token) {
                        return res.json({ 
                            success: false,
                            error_code: String(error_message.ERROR_CODE_INVALID_TOKEN),
                            error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_INVALID_TOKEN),
                        });
                    } else {
                        let country = ''
                        if(type == Number(constant_json.USER_UNIQUE_NUMBER)){
                            country = await Country.findOne({countryname : detail?.country})
                        }else{
                            country = await Country.findById(detail?.country_id)
                        }
                        if(!country){
                            res.json({ 
                                success: false,
                                error_code: String(error_message.ERROR_CODE_NO_COUNTRY_FOUND),
                                error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_NO_COUNTRY_FOUND),
                            });
                            return
                        }
                        Redeem_point_history.find({
                            user_id: req.body.user_id,
                            user_type: type
                        }, null, {sort: {'unique_id': -1}}).then((wallet_history) => {
                            let json = {
                                success: true,
                                success_code: String(success_messages.MESSAGE_CODE_REDEEM_POINT_HISTORY_GET_SUCCESSFULLY),
                                success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_REDEEM_POINT_HISTORY_GET_SUCCESSFULLY),
                                wallet_history: wallet_history,
                                total_redeem_point: detail?.total_redeem_point                                
                            }
                            if(type == Number(constant_json.USER_UNIQUE_NUMBER)){
                                json['user_redeem_point_value'] = country?.user_redeem_settings[0]?.user_redeem_point_value
                                json['user_minimum_point_require_for_withdrawal'] = country?.user_redeem_settings[0]?.user_minimum_point_require_for_withdrawal
                            }else{
                                json['driver_redeem_point_value'] = country?.driver_redeem_settings[0]?.driver_redeem_point_value
                                json['driver_minimum_point_require_for_withdrawal'] = country?.driver_redeem_settings[0]?.driver_minimum_point_require_for_withdrawal
                            }
                            return res.json(json)
                        });
                    }
                }else{
                    return res.json({ 
                        success: false,
                        error_code: String(error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND),
                        error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND),
                    });
                }
            });
        } else {
            return res.json({ 
                success: false,
                error_code: String(response.error_code),
                error_message: response.error_message,
            });
        }
    });
};

exports.get_web_provider_weekly_earning_detail = async function(req,res){
    try{
        if (req.body.is_export) {
            req.query.host = req.get('host')
            req.query.protocol = req.protocol
            let request = {
                body: req.body,
                headers: {
                    is_show_email: req.headers.is_show_email,
                    is_show_phone: req.headers.is_show_phone,
                }
            }
            queue_manager.earningExportQueueOfProviderWeeklyEarning.add(request,{
                     jobId: Date.now()
                }).then((job) => {
                let export_history = new Export_history({
                    type: TRIP_LIST.PROVIDER_WEEKLY_EARNING,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id:req.body.export_user_id,
                    data: job.data
                })
                export_history.save()
                return res.json({ 
                    success: true,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: ""  
                });
            });
            return;
        }
        mExportDataController.get_web_provider_weekly_earning_detail_req_post(req, res);

    }catch(err){
        utils.error_response(err, req, res)
    }
}

// get weekly  earning in new user panel
exports.get_web_provider_weekly_earning_detail_req_post = async function (req, res) {
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
    if (!req.body) {
        req.body = req
    }


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
                return res.json({ 
                    success: true,
                    detail: array, timezone_for_display_date: timezone_for_display_date,
                    'current_page': 1, type: req.body.type, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date, 
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: "",  
                });
            } else {
                let pages = Math.ceil(array.length / number_of_rec);
                Trip_history.aggregate([condition, trip_condition, filter,sort,skip,limit]).then((array) => { 
                    if (array.length == 0) {
                        array = [];
                        return res.json({ 
                            success: true,
                            detail: array, timezone_for_display_date: timezone_for_display_date,
                            'current_page': 1, type: req.body.type, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date, 
                            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                            success_message: "",  
                        });

                    } else {

                        Trip_history.aggregate([condition, trip_condition, filter,sort,skip,limit]).then((trip_total) => { 


                            if (req.body.is_export) {
                                provider_history_export_excel(req, res)
                                return
                            }



                            if (trip_total.length == 0) {
                                array = [];

                                return res.json({ 
                                    success: true,
                                    detail: array, timezone_for_display_date: timezone_for_display_date,
                                    'current_page': 1, type: req.body.type, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date, 
                                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                                    success_message: "",  
                                });
                            } else {

                                return res.json({ 
                                    success: true,
                                    detail: array, timezone_for_display_date: timezone_for_display_date,
                                    'current_page': page, trip_total: trip_total, type: req.body.type, 'pages': pages, 'next': next, 'pre': pre, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date, 
                                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                                    success_message: "",  
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

function provider_history_export_excel(req, res) {

    if(req.body.search_item == 'first_name'){
        req.body.search_item = 'user_detail.first_name'
    }
    if (typeof req.body.provider_id == 'undefined') {
        res.redirect('/provider_login');
    } else {
        let search_item = 'unique_id';
        let search_value = '';
        let sort_order = -1;
        let sort_field = 'unique_id';
        let value = ""
        let start_date
        let end_date
        let search

        if (req.body.search_item) {
            value = req.body.search_value;
            value = value.trim();
            value = value.replace(/ +(?= )/g, '');
            value = new RegExp(value, 'i');
            sort_order = req.body.sort_item[1];
            sort_field = req.body.sort_item[0];
            search_item = req.body.search_item
            search_value = req.body.search_value;
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
            start_date = new Date(0);
            end_date = new Date(Date.now());
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


        let lookup = {
            $lookup:
            {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user_detail"
            }
        };
        let unwind = {$unwind: "$user_detail"};

        let lookup1 = {
            $lookup:
            {
                from: "providers",
                localField: "confirmed_provider",
                foreignField: "_id",
                as: "provider_detail"
            }
        };


        value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');

        if (search_item == "unique_id") {
            
            let query1 = {};
            if(value != "")
            {
                value = Number(value)
                query1[search_item] = {$eq: value};
                search = {"$match": query1};
            }
            else
            {
                search = {$match: {}};
           }
       } else if (search_item == "user_detail.first_name") {
        let query1 = {};
        let query2 = {};
        let query3 = {};
        let query4 = {};
        let query5 = {};
        let query6 = {};

        let full_name = value.split(' ');
        if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {

            query1[search_item] = {$regex: new RegExp(value, 'i')};
            query2['user_detail.last_name'] = {$regex: new RegExp(value, 'i')};

            search = {"$match": {$or: [query1, query2]}};
        } else {

            query1[search_item] = {$regex: new RegExp(value, 'i')};
            query2['user_detail.last_name'] = {$regex: new RegExp(value, 'i')};
            query3[search_item] = {$regex: new RegExp(full_name[0], 'i')};
            query4['user_detail.last_name'] = {$regex: new RegExp(full_name[0], 'i')};
            query5[search_item] = {$regex: new RegExp(full_name[1], 'i')};
            query6['user_detail.last_name'] = {$regex: new RegExp(full_name[1], 'i')};

            search = {"$match": {$or: [query1, query2, query3, query4, query5, query6]}};
        }
    } else {
        search = {"$match": {search_item: {$regex: new RegExp(value, 'i')}}};
    }
    query1['created_at'] = {$gte: start_date, $lt: end_date};
    let filter = {"$match":query1};

    let sort = {"$sort": {}};
    sort["$sort"][sort_field] = parseInt(sort_order);

    
    let prov = req.body.provider_id;
    let mongoose = require('mongoose');
    let Schema = mongoose.Types.ObjectId;
    let condition = {$match: {'confirmed_provider': {$eq: Schema(prov) }}};
    
    Trip_history.aggregate([condition,lookup, unwind, lookup1, filter,search, sort]).then((array) => { 
        let date = new Date()
        let time = date.getTime()
        let wb = new xl.Workbook();
        let ws = wb.addWorksheet('sheet1');
        let col = 1;

        let title
        if(req.body.header){
            title = req.body.header
        }else{
            title = {
                id : 'Id',
                user_id : 'UserId',
                user : 'User',
                driver_id : 'DriverId',
                driver : 'Driver',
                date : 'Date',
                status : 'Status',
                amout : 'Amount',
                payment : 'Payment',
                payment_status : 'Payment Status',
                title_status_cancel_by_provider : 'Cancelled By Provider',
                title_status_cancel_by_user : 'Cancelled By User',
                title_trip_status_coming : 'Coming',
                title_trip_status_arrived : 'Arrived',
                title_trip_status_trip_started : 'Started',
                title_trip_status_completed : 'Compeleted',
                title_trip_status_accepted : 'Accepted',
                title_trip_status_waiting : 'Waiting',
                title_pay_by_cash : 'Cash',
                title_pay_by_card : 'Card',
                title_pending : 'Pending',
                title_paid : 'Paid',
                title_not_paid : 'Not Paid'
            }
        }
        
        ws.cell(1, col++).string(title.id);
        ws.cell(1, col++).string(title.user_id);
        ws.cell(1, col++).string(title.user);
        ws.cell(1, col++).string(title.driver_id);
        ws.cell(1, col++).string(title.driver);
        ws.cell(1, col++).string(title.date);
        ws.cell(1, col++).string(title.status);
        ws.cell(1, col++).string(title.amount);
        ws.cell(1, col++).string(title.payment);
        ws.cell(1, col++).string(title.payment_status);

        array.forEach(function (data, index) {

            col = 1;
            ws.cell(index + 2, col++).number(data.unique_id);
            ws.cell(index + 2, col++).number(data.user_detail.unique_id);
            ws.cell(index + 2, col++).string(data.user_detail.first_name + ' ' + data.user_detail.last_name);

            if (data.provider_detail.length > 0) {
                ws.cell(index + 2, col++).number(data.provider_detail[0].unique_id);
                ws.cell(index + 2, col++).string(data.provider_detail[0].first_name + ' ' + data.provider_detail[0].last_name);
            } else {
                col += 2;
            }
            ws.cell(index + 2, col++).string(moment(data.created_at).format("DD MMM 'YY") + ' ' + moment(data.created_at).format("hh:mm a"));

            if (data.is_trip_cancelled == 1) {
                if (data.is_trip_cancelled_by_provider == 1) {
                    ws.cell(index + 2, col++).string(title.title_status_cancel_by_provider);
                } else if (data.is_trip_cancelled_by_user == 1) {
                    ws.cell(index + 2, col++).string(title.title_status_cancel_by_user);
                } else {
                    ws.cell(index + 2, col++).string(title.title_trip_status_cancelled);
                }
            } else {
                if (data.is_provider_status == PROVIDER_STATUS.COMING) {
                    ws.cell(index + 2, col++).string(title.title_trip_status_coming );
                } else if (data.is_provider_status == PROVIDER_STATUS.ARRIVED) {
                    ws.cell(index + 2, col++).string(title.title_trip_status_arrived );
                } else if (data.is_provider_status == PROVIDER_STATUS.TRIP_STARTED) {
                    ws.cell(index + 2, col++).string(title.title_trip_status_trip_started);
                } else if (data.is_provider_status == PROVIDER_STATUS.TRIP_COMPLETED) {
                    ws.cell(index + 2, col++).string(title.title_trip_status_completed );
                } else if (data.is_provider_status == PROVIDER_STATUS.ACCEPTED || data.is_provider_status == PROVIDER_STATUS.WAITING) {
                    if (data.is_provider_accepted == 1) {
                        ws.cell(index + 2, col++).string(title.title_trip_status_accepted );
                    } else {
                        ws.cell(index + 2, col++).string(title.title_trip_status_waiting);

                    }
                }
            }

            ws.cell(index + 2, col++).number(data.total);

            if (data.payment_mode == 1) {
                ws.cell(index + 2, col++).string(title.title_pay_by_cash);
            } else {
                ws.cell(index + 2, col++).string(title.title_pay_by_card);
            }

            if (data.payment_status == 0) {
                ws.cell(index + 2, col++).string(title.title_pending);
            } else {
                if (data.payment_status == 1) {
                    ws.cell(index + 2, col++).string(title.title_paid);
                } else {
                    ws.cell(index + 2, col++).string(title.title_not_paid);
                }
            }

            if (index == array.length - 1) {
                wb.write('data/xlsheet/' + time + '_provider_history.xlsx', async function (err) {
                    if (err) {
                        console.error(err);
                    } else {
                        let setting_detail = await Settings.findOne({},{history_base_url: 1})
                        let url = setting_detail.history_base_url + "/xlsheet/" + time + "_provider_history.xlsx";

                        if(res.json){
                            res.json(url);
                        }else{
                            res(url);
                        }
                    }
                });
            }
        })
    }, (err) => {
        utils.error_response(err, req, res)
    });

  }
}

exports.earning_details = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let search_item
        let search_value
        if (req.body.search_value == undefined) {
            search_item = 'provider_detail.first_name';
            search_value = '';
        } else {
            search_item = req.body.search_item;
            search_value = req.body.search_value;
        }
        let week_start_date_view = "";
        let week_end_date_view = "";
        let start_date
        let end_date
        if (req.body.weekly_filter != undefined) {

            let weekDuration = req.body.weekly_filter;
            weekDuration = weekDuration.split('-');

            week_start_date_view = weekDuration[0];
            week_end_date_view = weekDuration[1];

            start_date = new Date(week_start_date_view);
            end_date = new Date(week_end_date_view);

            start_date = start_date.setHours(0, 0, 0, 0);
            start_date = new Date(start_date);
            end_date = end_date.setHours(23, 59, 59, 999);
            end_date = new Date(end_date);
        } else {

            let today = new Date();
            end_date = new Date(today.setDate(today.getDate() + 6 - today.getDay()));
            today = new Date(end_date);
            start_date = new Date(today.setDate(today.getDate() - 6));
            start_date = start_date.setHours(0, 0, 0, 0);
            start_date = new Date(start_date);
            end_date = end_date.setHours(23, 59, 59, 999);
            end_date = new Date(end_date);
        }
        let lookup = {
            $lookup:
            {
                from: "providers",
                localField: "_id",
                pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1, unique_id: 1, phone: 1, wallet_currency_code: 1, country_phone_code: 1 } }],
                foreignField: "_id",
                as: "provider_detail"
            }
        };
        let value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');
        let search = {}
        if (search_item == "provider_detail.first_name") {
            let query1 = {};
            let query2 = {};
            let query3 = {};
            let query4 = {};
            let query5 = {};
            let query6 = {};

            let full_name = value.split(' ');
            if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['provider_detail.last_name'] = { $regex: new RegExp(value, 'i') };

                search = { "$match": { $or: [query1, query2] } };
            } else {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['provider_detail.last_name'] = { $regex: new RegExp(value, 'i') };
                query3[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                query4['provider_detail.last_name'] = { $regex: new RegExp(full_name[0], 'i') };
                query5[search_item] = { $regex: new RegExp(full_name[1], 'i') };
                query6['provider_detail.last_name'] = { $regex: new RegExp(full_name[1], 'i') };

                search = { "$match": { $or: [query1, query2, query3, query4, query5, query6] } };
            }
        } else {
            search = { "$match": {} };
            search["$match"][search_item] = { $regex: value };
        }
        let trip_filter = { "$match": {} };
        trip_filter["$match"]['complete_date_in_city_timezone'] = { $gte: start_date, $lt: end_date };

        let sort = { "$sort": {} };
        sort["$sort"]['provider_trip_end_time'] = parseInt(-1);
        let count = { $group: { _id: null, data: { $push: '$$ROOT' } } };
        let skip = {};
        let page = req.body.page
        skip["$skip"] = page * 10;
        let limit = {};
        limit["$limit"] = 10;
        let trip_condition = { 'is_trip_completed': 1 };
        let trip_condition_new = { $and: [{ 'is_trip_cancelled_by_user': 1 }, { 'pay_to_provider': { $gt: 0 } }] };
        trip_condition = { $match: { $or: [trip_condition, trip_condition_new] } };
        let provider_type_condition = { $match: { 'provider_type': Number(constant_json.PROVIDER_TYPE_PARTNER) } };
        let provider_weekly_analytic_data = {};
        let provider_type_id_condition = { $match: { 'provider_type_id': mongoose.Types.ObjectId(req.body.partner_id) } };

        let trip_group_condition = {
            $group: {
                _id: '$provider_id',
                total_trip: { $sum: 1 },
                completed_trip: { $sum: { $cond: [{ $eq: ["$is_trip_completed", 1] }, 1, 0] } },
                total: { $sum: '$total' },
                provider_have_cash: { $sum: '$provider_have_cash' },
                provider_service_fees: { $sum: '$provider_service_fees' },
                pay_to_provider: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', false] }, { '$eq': ['$is_transfered', false] }] }, '$pay_to_provider', 0] } },
                currency: {$first:'$currency'}
            }
        }

        let array = await Trip_history.aggregate([trip_condition, provider_type_condition, provider_type_id_condition, trip_filter, trip_group_condition, lookup, search, count])
        if (array.length == 0) {
            array = [];
            return res.json({ 
                success: true,detail: array, provider_weekly_analytic: provider_weekly_analytic_data, 
                success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                success_message: "",  
            }); 
        }
        let pages = Math.ceil(array[0].total / 10);
        let arrays = await Trip_history.aggregate([trip_condition, provider_type_condition, provider_type_id_condition, trip_filter, trip_group_condition, lookup, search, count, skip, limit])
        let trip_group_condition_total = {
            $group: {
                _id: null,
                total_trip: { $sum: 1 },
                completed_trip: { $sum: { $cond: [{ $eq: ["$is_trip_completed", 1] }, 1, 0] } },
                total: { $sum: '$total' },
                promo_payment: { $sum: '$promo_payment' },
                card_payment: { $sum: '$card_payment' },
                cash_payment: { $sum: '$cash_payment' },
                wallet_payment: { $sum: '$wallet_payment' },
                admin_earning: { $sum: { $subtract: ['$total', '$provider_service_fees'] } },
                admin_earning_in_currency: { $sum: { $subtract: ['$total_in_admin_currency', '$provider_service_fees_in_admin_currency'] } },
                provider_earning: { $sum: '$provider_service_fees' },
                provider_have_cash: { $sum: '$provider_have_cash' },
                pay_to_provider: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', false] }, { '$eq': ['$is_transfered', false] }] }, '$pay_to_provider', 0] } },
                currency: {$first:'$currency'}
            }
        }
        let trip_total = await Trip_history.aggregate([trip_condition, provider_type_condition, provider_type_id_condition, trip_filter, trip_group_condition_total])
        return res.json({ 
            success: true,pages: pages, detail: arrays, provider_weekly_analytic: provider_weekly_analytic_data, trip_total: trip_total, 
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message: "",  
        });
    } catch (error) {
        utils.error_response(error, req, res)
    }
}






exports.openride_trip_earning = async function(req,res){
    try{
        if (req.body.is_export) {
            req.query.host = req.get('host')
            req.query.protocol = req.protocol

            let request = {
                body: req.body,
                headers: {
                    is_show_email: req.headers.is_show_email,
                    is_show_phone: req.headers.is_show_phone,
                }
            }
            queue_manager.earningExportQueueOfTrip.add(request,{
                     jobId: Date.now()
                }).then((job) => {
                let export_history = new Export_history({
                    type: TRIP_LIST.EARNING_TRIP,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id:req.body.export_user_id,
                    data: job.data
                })
                export_history.save()
                return res.json({ 
                    success: true,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: ""
                });
            });
            return;
        }
        mExportDataController.openride_trip_earning_req_post(req, res);
    }catch(err){
        utils.error_response(err, req, res)
    }
}

//api for get trip list for trip earning
exports.openride_trip_earning_req_post = async function (req, res) {
    if(!req.body){
        req.body = req
    }
    let search_item;
    let search_value;
    let start_date = req.body.start_date
    let end_date = req.body.end_date
    let selected_country = req.body.selected_country;
    let selected_city = req.body.selected_city;

    if (req.body.search_item == undefined) {
        search_item = 'provider_details.first_name';
        search_value = '';
    } else {
        search_item = req.body.search_item;
        search_value = req.body.search_value;
    }

    let country_filter = { $match: {} };
    let city_filter = { $match: {} };
    let timezone = "";

    if (selected_country !== 'all') {
        let country = await Country.findOne({ _id: Schema(selected_country) })
        if (country) {
            timezone = country.country_all_timezone[0];
        }
        country_filter['$match']['country_id'] = { $eq: Schema(selected_country) };
        if (selected_city !== 'all') {
            let city = await City.findOne({ _id: selected_city })
            if (city) {
                timezone = city.timezone;
            }
            city_filter['$match']['city_id'] = { $eq: Schema(selected_city) };
        }
    }

    let search = { "$match": {} };
    let value = search_value;
    value = value.trim();
    value = value.replace(/ +(?= )/g, '');
    if (search_item == "provider_details.first_name") {
        let query1 = {};
        let query2 = {};
        let query4 = {};
        let query5 = {};

        let full_name = value.split(' ');
        if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {
            query1[search_item] = { $regex: new RegExp(value, 'i') };
            query2['provider_details.last_name'] = { $regex: new RegExp(value, 'i') };
            search = { "$match": { $or: [query1, query2] } };
        } else {
            query4['provider_details.first_name'] = { $regex: new RegExp(full_name[0], 'i') };
            query5['provider_details.last_name'] = { $regex: new RegExp(full_name[1], 'i') };
            search = { "$match": { $and: [query4, query5] } };
        }
    } else {
        if (value.length) {
            search["$match"][search_item] = { $regex: value };
            if (search_item == "unique_id") {
                search["$match"][search_item] = Number(value)
            }
        }
    }
    let trip_filter = { "$match": {} };

    let sort = {}
    let sort_item = req.body.sort_item 
    let sort_order = Number(req.body.sort_order)
    if(sort_item && sort_order){
        sort = {$sort:{
            [sort_item] : sort_order
        }}
    } else {
        sort = { $sort: { provider_trip_end_time: -1 } }
    }

    if (selected_city == 'all') {
        selected_city = null
    }

    if(start_date && end_date) {
        const startDate = moment(start_date).startOf('day').toDate();
        const endDate = moment(end_date).endOf('day').toDate();
        trip_filter["$match"]['complete_date_in_city_timezone'] = { $gte: startDate, $lt: endDate };
    }

    let trip_condition = { $match: { $or: [{ $and: [{ 'is_trip_cancelled': 1 }, { 'pay_to_provider': { $gt: 0 } }] }, { "is_trip_completed": 1 }] } }
    // let trip_condition = { $match: {  $or: [{'is_trip_completed': 1 , 'is_trip_cancelled': 1 }] }};
    // let trip_condition_new = {  'pay_to_provider': { $gt: 0 }  };    
    // let trip_condition_new = { $and: [{ 'is_trip_cancelled_by_user': 1 }, { 'pay_to_provider': { $gt: 0 } }] };
    // trip_condition = { $match: { $or: [trip_condition, trip_condition_new] } };

    let limit = Number(req.body.limit)
    let page = Number(req.body.page)
    let count
    let pagination
    if (page !== null && !req.body.is_export) {
        let number_of_rec = limit;
        let start = ((page + 1) * number_of_rec) - number_of_rec;
        let end = number_of_rec;
        count = { $group: { _id: null, total: { $sum: 1 }, result: { $push: "$$ROOT" } } };
        pagination = { $project: { total: { $ceil: { $divide: ['$total', limit] } }, data: { $slice: ['$result', start, end] } } }

    } else {
        count = { $group: { _id: null, total: { $sum: 1 }, result: { $push: "$$ROOT" } } };
        pagination = { $project: { total: 1, data: '$result' } }
    }

    // Country and city based restriction condition
    let country_city_condition = await utils.get_country_city_condition(COLLECTION.TRIP, req.headers)

    // project optimize query
    let Project = {
        $project: {
            unique_id: 1,
            provider_trip_end_time: 1,
            provider_details : 1,
            // "provider_detail._id": { $ifNull: ["$current_provider", "000000000000000000000000"] },
            // "provider_detail.unique_id": { $ifNull: ["$provider_unique_id", 0] },
            // "provider_detail.first_name": "$provider_first_name",
            // "provider_detail.last_name": "$provider_last_name",
            // "provider_detail.phone": !req.headers.is_show_phone ? HIDE_DETAILS.PHONE : { $ifNull: ["$provider_phone", HIDE_DETAILS.PHONE] },
            // "provider_detail.country_phone_code": !req.headers.is_show_phone ? HIDE_DETAILS.COUNTRY_CODE : { $ifNull: ["$provider_phone_code", HIDE_DETAILS.COUNTRY_CODE] },
            currency: 1,
            total: 1,
            card_payment: 1,
            cash_payment: 1,
            wallet_payment: 1,
            provider_service_fees: 1,
            pay_to_provider: 1
        }
    }

    if (req.body.is_export) {
        Project = {
            $project: {
                unique_id: 1,
                provider_trip_end_time: 1,
                created_at: 1,
                provider_details : 1,
                total: 1,
                provider_service_fees: 1,
                pay_to_provider: 1,
                provider_have_cash: 1
            }
        }
    }
    let trips = await OpenRide.aggregate([{ $match: country_city_condition }, trip_condition, trip_filter, country_filter, city_filter, Project, search, sort, count, pagination])
    if (req.body.is_export) {
        generate_trip_earning_excel(req, res, trips[0].data, req.body.header)
        return
    }

    if (trips.length == 0) {
        return res.json({ 
            success: true,
            detail: [], pages: 0, is_show_email: req.headers.is_show_email, is_show_phone: req.headers.is_show_phone, 
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message: "",  
        });
    }
    let trip_group_condition_total = {
        $group: {
            _id: null,
            total_trip: { $sum: 1 },
            completed_trip: { $sum: { $cond: [{ $eq: ["$is_trip_completed", 1] }, 1, 0] } },
            total: { $sum: '$total' },
            promo_payment: { $sum: '$promo_payment' },
            card_payment: { $sum: '$card_payment' },
            cash_payment: { $sum: '$cash_payment' },
            wallet_payment: { $sum: '$wallet_payment' },
            admin_earning: { $sum: { $subtract: ['$total', '$provider_service_fees'] } },
            admin_earning_in_currency: { $sum: { $subtract: ['$total_in_admin_currency', '$provider_service_fees_in_admin_currency'] } },
            provider_earning: { $sum: '$provider_service_fees_in_admin_currency' },
            provider_have_cash: { $sum: '$provider_have_cash' },
            pay_to_provider: { $sum: '$pay_to_provider' }
        }
    }
    let trip_total = await OpenRide.aggregate([{ $match: country_city_condition }, trip_condition, trip_filter, country_filter, city_filter, search, trip_group_condition_total])
    if (trip_total.length == 0) {
        return res.json({ 
            success: true,
            detail: trips[0].data, trip_total: [], pages: trips[0].total, is_show_email: req.headers.is_show_email, is_show_phone: req.headers.is_show_phone,             
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message: "",  
        });
    }
    return res.json({ 
        success: true,
        detail: trips[0].data, trip_total: trip_total, pages: trips[0].total, is_show_email: req.headers.is_show_email, is_show_phone: req.headers.is_show_phone, 
        success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
        success_message: "",  
    });
}

// rental trip earning report api
exports.rental_trip_earning = async function(req,res){
    try{
        if (req.body.is_export) {
            req.query.host = req.get('host')
            req.query.protocol = req.protocol

            let request = {
                body: req.body,
                headers: {
                    is_show_email: req.headers.is_show_email,
                    is_show_phone: req.headers.is_show_phone,
                }
            }
            queue_manager.earningExportRecordsQueueOfRentalTrip.add(request,{
                     jobId: Date.now()
                }).then((job) => {
                let export_history = new Export_history({
                    type: TRIP_LIST.RENTAL_TRIP_EARNING,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id:req.body.export_user_id,
                    data: job.data
                })
                export_history.save()
                return res.json({ 
                    success: true,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: ""
                });
            });
            return;
        }
        mExportDataController.rental_trip_earning_req_post(req, res);

    }catch(err){
        utils.error_response(err, req, res)
    }
}

//api for get trip list for rental trip earning
exports.rental_trip_earning_req_post = async function (req, res) {
    console.log("rental_trip_earning_req_post");
    console.log(req.body);
    
    if(!req.body){
        req.body = req
    }
    let search_item = req.body.search_item || 'provider_first_name';
    let search_value = req.body.search_value || '';
    let start_date = req.body.start_date;
    let end_date = req.body.end_date;
    let selected_country = req.body.selected_country;

    let country_filter = { $match: {} };
    let timezone = "";

    if (selected_country !== 'all') {
        let country = await Country.findOne({ _id: Schema(selected_country) })
        if (country) {
            timezone = country.country_all_timezone[0];
        }
        country_filter['$match']['country_id'] = { $eq: Schema(selected_country) };
    }

    let search = { "$match": {} };
    let value = search_value;
    value = value.trim();
    value = value.replace(/ +(?= )/g, '');
    if (search_item == "provider_first_name") {
        let query1 = {};
        let query2 = {};
        let query4 = {};
        let query5 = {};

        let full_name = value.split(' ');
        if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {

            query1[search_item] = { $regex: new RegExp(value, 'i') };
            query2['provider_last_name'] = { $regex: new RegExp(value, 'i') };
            search = { "$match": { $or: [query1, query2] } };
        } else {

            query4['provider_first_name'] = { $regex: new RegExp(full_name[0], 'i') };
            query5['provider_last_name'] = { $regex: new RegExp(full_name[1], 'i') };
            search = { "$match": { $and: [query4, query5] } };
        }
    } else {
        if (value.length) {
            search["$match"][search_item] = { $regex: value };
            if (search_item == "unique_id") {
                search["$match"][search_item] = Number(value)
            }
        }
    }
    let trip_filter = { "$match": {} };

    let sort = {}
    let sort_item = req.body.sort_item 
    let sort_order = Number(req.body.sort_order)
    if(sort_item && sort_order){
        sort = {$sort:{
            [sort_item] : sort_order
        }}
    } else {
        sort = { $sort: { provider_trip_end_time: -1 } }
    }

    if(start_date && end_date) {
        const startDate = moment(start_date).startOf('day').toDate();
        const endDate = moment(end_date).endOf('day').toDate();
        trip_filter["$match"]['complete_date_in_city_timezone'] = { $gte: startDate, $lt: endDate };
    }

    let trip_condition = { 'is_trip_completed': 1 };
    let trip_condition_new = { $and: [{ 'is_trip_cancelled_by_user': 1 }, { 'pay_to_provider': { $gt: 0 } }] };
    trip_condition = { $match: { $or: [trip_condition, trip_condition_new] } };

    let limit = Number(req.body.limit)
    let page = Number(req.body.page)
    let count
    let pagination
    if (page !== null && !req.body.is_export) {
        let number_of_rec = limit;
        let start = ((page + 1) * number_of_rec) - number_of_rec;
        let end = number_of_rec;
        count = { $group: { _id: null, total: { $sum: 1 }, result: { $push: "$$ROOT" } } };
        pagination = { $project: { total: { $ceil: { $divide: ['$total', limit] } }, data: { $slice: ['$result', start, end] } } }

    } else {
        count = { $group: { _id: null, total: { $sum: 1 }, result: { $push: "$$ROOT" } } };
        pagination = { $project: { total: 1, data: '$result' } }
    }

    // Country and city based restriction condition
    let country_city_condition = await utils.get_country_city_condition(COLLECTION.TRIP, req.headers)

    // project optimize query
    let project = {
        $project: {
            unique_id: 1,
            provider_completed_time: 1,
            provider_id: 1,
            provider_unique_id: 1,
            provider_first_name: 1,
            provider_last_name: 1,
            "provider_phone": !req.headers.is_show_phone ? HIDE_DETAILS.PHONE : "$provider_phone",
            "provider_phone_code": !req.headers.is_show_phone ? HIDE_DETAILS.COUNTRY_CODE : "$provider_phone_code",
            currency: 1,
            total: 1,
            card_payment: 1,
            cash_payment: 1,
            wallet_payment: 1,
            provider_service_fees: 1,
            is_trip_completed: 1
        }
    }

    if (req.body.is_export) {
        project = {
            $project: {
                unique_id: 1,
                provider_completed_time: 1,
                created_at: 1,
                provider_id: 1,
                provider_unique_id: 1,
                provider_first_name: 1,
                provider_last_name: 1,
                "provider_phone": !req.headers.is_show_phone ? HIDE_DETAILS.PHONE : "$provider_phone",
                "provider_phone_code": !req.headers.is_show_phone ? HIDE_DETAILS.COUNTRY_CODE : "$provider_phone_code",
                currency: 1,
                total: 1,
                card_payment: 1,
                cash_payment: 1,
                wallet_payment: 1,
                provider_service_fees: 1,
                is_trip_completed: 1
            }
        }
    }

    let trips = await Rental_Trip.aggregate([{ $match: country_city_condition }, trip_condition, trip_filter, country_filter, search, project, sort, count, pagination])
    if (req.body.is_export) {
        generate_rental_trip_earning_excel(req, res, trips[0].data, req.body.header)
        return
    }

    if (trips.length == 0) {
        res.json({ 
            success: true, detail: [], pages: 0, is_show_email: req.headers.is_show_email, is_show_phone: req.headers.is_show_phone,
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message: "",  
        });
        return;
    }

    let trip_group_condition_total = {
        $group: {
            _id: null,
            total_trip: { $sum: 1 },
            completed_trip: { $sum: { $cond: [{ $eq: ["$is_trip_completed", 1] }, 1, 0] } },
            total: { $sum: '$total' },
            promo_payment: { $sum: '$promo_payment' },
            card_payment: { $sum: '$card_payment' },
            cash_payment: { $sum: '$cash_payment' },
            wallet_payment: { $sum: '$wallet_payment' },
            admin_earning: { $sum: { $subtract: ['$total', '$provider_service_fees'] } },
            provider_earning: { $sum: '$provider_service_fees' },
            pay_to_provider: { $sum: '$pay_to_provider' }
        }
    }
    let trip_total = await Rental_Trip.aggregate([{ $match: country_city_condition }, trip_condition, trip_filter, country_filter, search, project, trip_group_condition_total])
    if (trip_total.length == 0) {
        res.json({ 
            success: true, detail: trips[0].data, trip_total: [], pages: trips[0].total, is_show_email: req.headers.is_show_email, is_show_phone: req.headers.is_show_phone,
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message: "",  
        });
        return;
    }
    return res.json({ 
        success: true, detail: trips[0].data, trip_total: trip_total, pages: trips[0].total, is_show_email: req.headers.is_show_email, is_show_phone: req.headers.is_show_phone,
        success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
        success_message: "",  
    });
}

async function generate_rental_trip_earning_excel(req, res, array, header) {
    let setting_detail = await Settings.findOne({},{history_base_url: 1,timezone_for_display_date:1})
    const currentDate = moment().tz(setting_detail.timezone_for_display_date).format('HHmm_DDMMYYYY');
    let wb = new xl.Workbook();
    let ws = wb.addWorksheet('sheet1');
    let col = 1;
    let title = JSON.parse(header);
    ws.cell(1, col++).string(title.trip_id);
    ws.cell(1, col++).string(title.trip_end);
    ws.cell(1, col++).string(title.driver_id);
    ws.cell(1, col++).string(title.name);
    ws.cell(1, col++).string(title.phone);
    ws.cell(1, col++).string(title.total);
    ws.cell(1, col++).string(title.card);
    ws.cell(1, col++).string(title.wallet);
    ws.cell(1, col++).string(title.driver_profit);
    ws.cell(1, col++).string(title.pay_to_driver);

    array.forEach(function (data, index) {
        col = 1;
        ws.cell(index + 2, col++).number(data.unique_id);
        ws.cell(index + 2, col++).string(moment(data.provider_completed_time).format("DD MMM 'YY") + ' ' + moment(data.provider_completed_time).format("hh:mm a"));
        ws.cell(index + 2, col++).number(data.provider_unique_id);
        ws.cell(index + 2, col++).string(data.provider_first_name + ' ' + data.provider_last_name);
        ws.cell(index + 2, col++).string(data.provider_phone_code + data.provider_phone);
        ws.cell(index + 2, col++).number(data.total);
        ws.cell(index + 2, col++).number(data.card_payment);
        ws.cell(index + 2, col++).number(data.wallet_payment);
        ws.cell(index + 2, col++).number(data.provider_service_fees);
        ws.cell(index + 2, col++).number(data.provider_service_fees);

        if (index == array.length - 1) {

            wb.write('data/xlsheet/'+ ( req.body.earning_type ? req.body.earning_type : "Trip_earning" ) + '_' + currentDate + '.xlsx', async function (err) {
                if (err) {
                    console.error(err);
                } else {                    
                    let url = setting_detail.history_base_url +"/xlsheet/" + ( req.body.earning_type ? req.body.earning_type : "Trip_earning" ) + '_' + currentDate + '.xlsx';
                    // let url = "http://192.168.0.153:5001/history" +"/xlsheet/" + ( req.body.earning_type ? req.body.earning_type : "Trip_earning" ) + '_' + currentDate + '.xlsx';
                    
                    if(res.json){
                        res.json(url);
                    }else{
                        res(url);
                    }
                }
            });
        }
    });
}