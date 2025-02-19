let mongoose = require('mongoose');
let Schema = mongoose.Types.ObjectId;
let xl = require('excel4node');
let moment = require('moment-timezone');
let fs = require("fs");
let utils = require('./utils')
let queue_manager = require('./queue_manager')
let mExportDataController = require('./history_controller.js');
let Trip = require('mongoose').model('Trip');
let Trip_history = require('mongoose').model('Trip_history');
let Export_history = require('mongoose').model('export_history');
let Setting = require('mongoose').model('Settings');
let User = require('mongoose').model('User')
let Provider = require('mongoose').model('Provider')
let Corporate = require('mongoose').model('Corporate')
let Country = require('mongoose').model('Country')
let Settings = require('mongoose').model('Settings')
let OpenRide = require('mongoose').model('Open_Ride');
let Rental_Trip = require('mongoose').model('Rental_Trip');
const {
    TRIP_LIST,
    EXPORT_HISTORY_STATUS,
    PROVIDER_STATUS,
    COLLECTION,
    RENTAL_TRIP_STATUS
} = require('./constant.js')
const {
    TYPE_ERROR_CODE,
} = require('../utils/error_code.js');

exports.get_trip_report = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        if (req.query.is_excel_sheet) {
            req.query.host = req.get('host')
            req.query.protocol = req.protocol

            let request = {
                query: req.query,
                headers: {
                    is_show_email: req.headers.is_show_email,
                    is_show_phone: req.headers.is_show_phone,
                }
            }
            
            queue_manager.completeTripReportQueue.add(request,{
                     jobId: Date.now()
                }).then((job) => {
                let export_history = new Export_history({
                    type: req.query.type,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id:req.query.export_user_id,
                    data: job.data
                })
                export_history.save();
                res.json({ 
                    success: true,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: "" 
                });
            });
            return;
        }
        mExportDataController.get_trip_report_data(req, res);
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_trip_report_data = async function (req, res){

    if(!req.query){
        req.query = req;
    }

    const user_selected_country_id = req.query.country_id; 
    const page = Number(req.query.page) || 1; 
    const limit = Number(req.query.limit) || 1;
    const type = req.query?.type

    const optional_filters = [];
    let start_date
    let end_date
    if (req.query.start_date == '' || req.query.start_date == undefined) {
        let date = new Date()
        start_date = new Date(null);
        end_date = date.setHours(23, 59, 59, 999);
        end_date = new Date(end_date);
        optional_filters.push({ 'created_at': { $gte: start_date, $lt: end_date } })
    } else {
        const startDate = moment(req.query.start_date).startOf('day').toDate();
        const endDate = moment(req.query.end_date).endOf('day').toDate();
        optional_filters.push({ 'complete_date_in_city_timezone': { $gte: startDate, $lt: endDate } })
    }

    if(req.query.booking_type){
        const booking_type_value = Number(req.query.booking_type);
        const booking_type_filter = booking_type_value == 0 ? { booking_type: { $nin: [100] } } : { booking_type: booking_type_value };
        optional_filters.push(booking_type_filter);
    }
    
    if(req.query.created_by){
        optional_filters.push({"trip_type": Number(req.query.created_by)});
    }

    if(req.query.payment_mode){
        const payment_mode_value = Number(req.query.payment_mode);
        optional_filters.push(payment_mode_value == 2
        ? { $or: [{ "payment_mode": 0 }, { "payment_mode": 1 }] }
        : { "payment_mode": payment_mode_value }
    );
    }

    if (req.query.trip_status) {
        const trip_status_value = Number(req.query.trip_status);
        let condition;
        if (trip_status_value == 2) {
            condition = { $or: [{ "is_trip_completed": 1 }, { "is_trip_cancelled": 1 }] };
        } else if (trip_status_value == 1) {
            condition = { "is_trip_completed": 1 };
        } else {
            condition = { "is_trip_cancelled": 1 };
        }
        optional_filters.push(condition);
    }

    if(req.query.user_name){
        let search_value = req.query.user_name
            let condition = {
                $or: [
                    {
                        'user_first_name': { $regex: search_value, $options: 'i' },
                    },
                    {
                        'user_last_name': { $regex: search_value, $options: 'i' },
                    }
                ]
            }
        
        let value = (req.query.user_name).split(' ')
        if (value.length > 1) {
            condition = {}
            condition['user_first_name'] = { $regex: value[0], $options: 'i' }
            condition['user_last_name'] = { $regex: value[1], $options: 'i' }
        }
        optional_filters.push(condition)
    }
 

    if(req.query.city_id){
        optional_filters.push({"city_id": Schema(req.query.city_id) });
    }

    if(req.query.driver_id){
        optional_filters.push({"confirmed_provider": Schema(req.query.driver_id) });
    }

    if(req.query.provider_type_id){
        optional_filters.push({"provider_type_id": Schema(req.query.provider_type_id) });
    }

    if(req.query.user_type_id){
        optional_filters.push({"user_type_id": Schema(req.query.user_type_id) });
    }

    if(req.query.service_type_id){
        optional_filters.push({"type_id": Schema(req.query.service_type_id) });
    }

    const and_condition = { $and: optional_filters };

    const aggregationPipeline = [
        {
            $match: {
                "country_id": Schema(user_selected_country_id),
                ...and_condition,
            },  
        },
        {
            $lookup: {
                from: "types",
                localField: "type_id",
                foreignField: "_id",
                as: "type_detail"
            }
        },
        {
            $unwind: {
                path: "$type_detail",
                preserveNullAndEmptyArrays: true
              }
        },
    ];

    let Project = {
        $project: { unique_id: 1, user_first_name:1,user_last_name:1,provider_first_name:1, provider_last_name:1,vehicle_name: '$type_detail.typename',total: 1,provider_trip_start_time:1, is_provider_status: 1, payment_mode: 1, is_trip_completed: 1, user_create_time: 1, is_trip_cancelled: 1, is_trip_cancelled_by_user: 1, is_trip_cancelled_by_provider: 1, is_provider_accepted: 1, payment_status: 1, user_details: '$user_detail.first_name', provider_details: '$provider_details', server_start_time_for_schedule: 1, provider_trip_end_time: 1 , fixed_price : 1,currency:1,total_distance:1,total_time:1,base_distance_cost:1,time_cost:1,waiting_time_cost:1,distance_cost:1,user_tax_fee:1,provider_tax_fee:1,total_after_tax_fees:1,total_after_surge_fees:1,total_after_user_tax_fees:1,user_miscellaneous_fee:1,provider_miscellaneous_fee:1,tip_amount:1,toll_amount:1,total_service_fees:1,total_after_promo_payment:1,total_after_referral_payment:1,source_address:1,destination_address:1,total_waiting_time:1,tax_fee:1,provider_profit_fees:1}
    }

    let sort = {}
    let sort_item = req.query.sort_item
    let sort_order = Number(req.query.sort_order)
    if (sort_item && sort_order) {
        sort = {
            $sort: {
                [sort_item]: sort_order
            }
        }
    } else {
        sort = { $sort: { unique_id: -1 } }
    }
   

    // Country and city based restriction condition
    let country_city_condition = await utils.get_country_city_condition(COLLECTION.TRIP, req.headers)
    aggregationPipeline.push({$match: country_city_condition},Project)

    let count = [{ $group: { _id: null, total: { $sum: 1 } } }];
    let total_trip_list = await Trip_history.aggregate([...aggregationPipeline,...count]);
    let total_page = Math.ceil((total_trip_list[0]?.total || 0) / limit)

    if (req.query.is_excel_sheet) {
        let total_trip_list = await Trip_history.aggregate(aggregationPipeline);
        generate_excel_for_complete_trip_report(req, res, total_trip_list, type , req.query.header)
        return
    }

    aggregationPipeline.push(
        sort,
        { $skip: (page - 1) * limit },
        { $limit: limit },
    );

    let trip_list = await Trip_history.aggregate(aggregationPipeline); 
    if(res.json){
        res.json({ 
            success: true,trip_list: trip_list,total_page:total_page,
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message: '',  
        });
    }else{
        res({ 
            success: true,trip_list: trip_list,total_page:total_page,
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message: '',  
        });
    }
}

exports.get_trip_list = async function (req, res) {
    try {
        let params_array = [{ name: "type", type: 'string' }]
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        if (req.query.is_excel_sheet) {
            req.query.host = req.get('host')
            req.query.protocol = req.protocol

            let request = {
                query: req.query,
                headers: {
                    is_show_email: req.headers.is_show_email,
                    is_show_phone: req.headers.is_show_phone,
                }
            }
            
            queue_manager.tripExportQueue.add(request,{
                     jobId: Date.now()
                }).then((job) => {
                let export_history = new Export_history({
                    type: req.query.type,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id: req.query.export_user_id,
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
        mExportDataController.get_trip_data(req, res);
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_trip_data = async function (req, res){
    if(!req.query){
        req.query = req;
    }

    let type = req.query.type
    let limit = Number(req.query.limit)
    let page = Number(req.query.page) - 1

    let search_by = req.query.search_by
    let search_value = req.query.search_value
    
    // pagination query 
    let condition = {}
    let user_type_condition = { $match: {} };
    let status_condition = { $match: {} };
    let booking_type_condition = { $match: {} };
    let table;
    let start_date = req.query.start_date;
    let end_date = req.query.end_date;
    let payment_mode = Number(req.query.payment_mode)
    let payment_condition = { $match: { payment_mode: { $eq: payment_mode } } }
    let date_filter_value = "created_at";

    if(req.query.booking_type && req.query.booking_type != 0){
        booking_type_condition['$match']['booking_type'] = { $eq: +req.query.booking_type }
    }
    if (type == TRIP_LIST.RUNNING_TRIP  || type == TRIP_LIST.RUNNING_TRIP_OF_PARTNER) {
        table = Trip;
        status_condition['$match']['is_trip_cancelled'] = { $eq: 0 }
        status_condition['$match']['$or'] = [{ is_trip_completed :0 },{is_trip_completed:1,payment_status:{$ne:1}}]
        status_condition['$match']['is_schedule_trip'] = { $eq: false }
    }
    else if (type == TRIP_LIST.SCHEDULED_TRIP) {
        table = Trip;
        status_condition['$match']['is_trip_cancelled'] = { $eq: 0 }
        status_condition['$match']['is_trip_completed'] = { $eq: 0 }
        status_condition['$match']['is_schedule_trip'] = { $eq: true }
    }
    else if (type == TRIP_LIST.COMPLETED_TRIP) {
        table = Trip_history;
        if (req.query.user_type_id || req.query.provider_type_id) {
            let query1 = {}
            let query2 = {}
            if (req.query.user_type_id && req.query.user_type != '1') {
                user_type_condition['$match']['user_type_id'] = { $eq: Schema(req.query.user_type_id) }
            }
            if (req.query.user_type_id && req.query.user_type == '1') {
                user_type_condition['$match']['user_id'] = { $eq: Schema(req.query.user_type_id) }
            }
            query1['is_trip_completed'] = { $eq: 1 }
            query2['is_trip_cancelled'] = { $eq: 0 }
            status_condition = { "$match": { $or: [query1, query2] } }
        } else {
            status_condition = { $match: { $or: [{ is_trip_completed: 1 }, { is_trip_cancelled: 0 }] } }
        }
    }
    else if(type == 0  || type == TRIP_LIST.COMPLETED_TRIP_OF_PARTNER){
        table = Trip_history;
        if (req.query.user_type_id || req.query.provider_type_id) {
            let query1 = {}
            let query2 = {}
            if (req.query.user_type_id && req.query.user_type != '1') {
                user_type_condition['$match']['user_type_id'] = { $eq: Schema(req.query.user_type_id) }
            }
            if (req.query.user_type_id && req.query.user_type == '1') {
                user_type_condition['$match']['user_id'] = { $eq: Schema(req.query.user_type_id) }
            }
            query1['is_trip_completed'] = { $eq: 1 }
            query2['is_trip_cancelled'] = { $eq: 1}
            status_condition = { "$match": { $or: [query1, query2] } }
        } else {
            status_condition = { $match: { $or: [{ is_trip_completed: 1 }, { is_trip_cancelled: 0 }] } }
        }
    }
    else {
        table = Trip_history;
        status_condition['$match']['is_trip_cancelled'] = { $eq: 1 }
    }
    if (req.query.provider_type_id) {
        user_type_condition['$match']['provider_type_id'] = { $eq: Schema(req.query.provider_type_id) }
    }
    if (req.query.provider_id) {
        user_type_condition['$match']['provider_id'] = { $eq: Schema(req.query.provider_id) }
    }
    let date_filter = { "$match": {} }
    if (type == TRIP_LIST.SCHEDULED_TRIP) {
        date_filter_value = "server_start_time_for_schedule";
    }
    if (type == TRIP_LIST.COMPLETED_TRIP) {
        date_filter_value = "complete_date_in_city_timezone";
    }
    if (type == TRIP_LIST.CANCELLED_TRIP) {
        date_filter_value = "complete_date_in_city_timezone";
    }
    if (req.query.start_date == '' || req.query.start_date == undefined) {
        let date = new Date()
        start_date = new Date(null);
        end_date = date.setHours(23, 59, 59, 999);
        end_date = new Date(end_date);

        date_filter["$match"][date_filter_value] = { $gte: start_date, $lt: end_date }
    } else {

        const startDate = moment(req.query.start_date).startOf('day').toDate();
        const endDate = moment(req.query.end_date).endOf('day').toDate();
        date_filter["$match"][date_filter_value] = { $gte: startDate, $lt: endDate }
    }
    if (payment_mode == undefined || payment_mode == 2) {
        payment_condition = { $match: {} }
    }
    let service_type_lookup = {
        $lookup:
            {
                from: "types",
                localField: "type_id",
                foreignField: "_id",
                as: "service_type_detail"
            }
    }
    let service_type_unwind = {$unwind: "$service_type_detail"};
    // project optimize query
    let Project = {
        $project: {
            provider_id: 1,
            unique_id: 1,
            total: 1,
            is_provider_status: 1,
            payment_mode: 1,
            is_trip_completed: 1,
            complete_date_in_city_timezone: 1,
            user_create_time: 1,
            is_trip_cancelled: 1,
            is_trip_cancelled_by_user: 1,
            is_trip_cancelled_by_provider: 1,
            is_provider_accepted: 1,
            payment_status: 1,
            server_start_time_for_schedule: 1,
            provider_trip_end_time: 1,
            fixed_price: 1,
            currency: 1,
            "user_details._id": "$user_id",
            "user_details.first_name": "$user_first_name",
            "user_details.last_name": "$user_last_name",
            "user_details.unique_id": { $ifNull: ["$user_unique_id", 0] },
            "provider_details._id": "$current_provider",
            "provider_details.first_name": "$provider_first_name",
            "provider_details.last_name": "$provider_last_name",
            "provider_details.unique_id": { $ifNull: ["$provider_unique_id", 0] },
            "vehicle_details._id": "$type_id",
            "vehicle_details.typename": { $ifNull: ["$service_type_detail.typename", "***"] },
        }
    }

    if (search_by && search_value) {
        if (search_by == 'unique_id' || search_by == 'payment_mode') {
            search_value = Number(req.query.search_value)
            condition[search_by] = search_value
        } else {
            condition[search_by] = { $regex: search_value, $options: 'i' }
            let value = search_value.split(' ')
            let name = !search_by.includes("typename")
            if (value.length > 1 && name) {
                condition[search_by] = { $regex: value[0], $options: 'i' }
                let diff_search = search_by.split('.')
                condition[diff_search[0] + '.last_name'] = { $regex: value[1], $options: 'i' }
            }
        }
    }
    // sorting
    let sort = {}
    let sort_item = req.query.sort_item
    let sort_order = Number(req.query.sort_order)
    if (sort_item && sort_order) {
        sort = {
            $sort: {
                [sort_item]: sort_order
            }
        }
    } else {
        sort = { $sort: { unique_id: -1 } }
    }
    if (req.query.is_excel_sheet) {
        page = null
        Project = {
            $project: {
                payment_status: 1,
                total: 1,
                payment_mode: 1,
                is_provider_status: 1,
                unique_id: 1,
                created_at: 1,
                refund_amount: 1,
                is_amount_refund: 1,
                server_start_time_for_schedule: 1,
                provider_id: 1,
                is_trip_completed: 1,
                complete_date_in_city_timezone: 1,
                user_create_time: 1,
                is_trip_cancelled: 1,
                is_trip_cancelled_by_user: 1,
                is_trip_cancelled_by_provider: 1,
                is_provider_accepted: 1,
                provider_trip_end_time: 1,
                fixed_price: 1,
                currency: 1,
                "user_details._id": "$user_id",
                "user_details.first_name": "$user_first_name",
                "user_details.last_name": "$user_last_name",
                "user_details.unique_id": { $ifNull: ["$user_unique_id", 0] },
                "provider_details._id": "$current_provider",
                "provider_details.first_name": "$provider_first_name",
                "provider_details.last_name": "$provider_last_name",
                "provider_details.unique_id": { $ifNull: ["$provider_unique_id", 0] },
                "vehicle_details._id": "$type_id",
                "vehicle_details.typename": { $ifNull: ["$typename", "***"] },
            }
        }
    }

    // total count login
    let count;
    let pagination;
    if (page !== null) {
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
    
    // apply query for particular type
    let trip_list = await table.aggregate([{ $match: country_city_condition }, date_filter, status_condition, user_type_condition, booking_type_condition, payment_condition, service_type_lookup, service_type_unwind, Project, { $match: condition }, sort, count, pagination])
    if (req.query.is_excel_sheet) {
        generate_excel(req, res, trip_list[0].data, type , req.query.header)
        return
    }
    if(res.json){
        res.json({ 
            success: true,trip_list: trip_list,
            success_message: "",
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
        });
    }else{
        res({ 
            success: true,trip_list: trip_list,
            success_message: "",
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
        });
    }
}

// excel sheet download For complete_trip_report
async function generate_excel_for_complete_trip_report(req, res, array, type , header) {
    let setting_detail = await Setting.findOne({},{history_base_url: 1,timezone_for_display_date:1})
    const currentDate = moment().tz(setting_detail.timezone_for_display_date).format('HHmm_DDMMYYYY');
    let wb = new xl.Workbook();
    let ws = wb.addWorksheet('sheet1');
    let col = 1;
    let typename = 'complete_trip_report';
    let title
            if(header){
                title = JSON.parse(header)
            }else{
                title = {
                        id : 'Trip ID',
                        user_name: 'User',
                        driver_name: 'Driver',
                        status : 'Status',
                        vehicle_name: 'Service Type',
                        date: 'Date',
                        amount : 'amount',
                        payment : 'Payment',
                        payment_status : 'Payment Status',
                        title_pay_by_cash : 'Cash',
                        title_pay_by_card : 'Card',
                        title_pending : 'Pending',
                        title_paid : 'Paid',
                        title_not_paid : 'Not Paid',
                        title_completed: 'Completed',
                        title_cancelled: 'Cancelled',
                        base_price: 'Base Price',
                        distance: 'Distance',
                        distance_price: 'Distance Price',
                        time: 'Time',
                        time_price: 'Time Price',
                        waiting_time: 'Waiting Time',
                        wait_time_price: 'Waiting Time Price',
                        user_tax: 'User Tax',
                        tax: 'Tax',
                        user_miscellaneous_fee: 'User Miscellaneous Fee',
                        tip: 'Tip',
                        toll: 'Toll',
                        driver_profit: 'Driver Profit',
                        driver_tax: 'Driver Tax',
                        driver_miscellaneous_fee: 'Driver Miscellaneous Fee',
                        pickup_address: 'Pickup Address',
                        destination_address: 'Destination Address'
                    }

            }
        ws.cell(1, col++).string(title.id);
        ws.cell(1, col++).string(title.user_name);
        ws.cell(1, col++).string(title.driver_name);
        ws.cell(1, col++).string(title.status);
        ws.cell(1, col++).string(title.vehicle_name);
        ws.cell(1, col++).string(title.date);
        ws.cell(1, col++).string(title.amount);
        ws.cell(1, col++).string(title.payment);
        ws.cell(1, col++).string(title.payment_status);
        ws.cell(1, col++).string(title.base_price);
        ws.cell(1, col++).string(title.distance);
        ws.cell(1, col++).string(title.distance_price);
        ws.cell(1, col++).string(title.time);
        ws.cell(1, col++).string(title.time_price);
        ws.cell(1, col++).string(title.waiting_time);
        ws.cell(1, col++).string(title.wait_time_price);
        ws.cell(1, col++).string(title.user_tax);
        ws.cell(1, col++).string(title.tax);
        ws.cell(1, col++).string(title.user_miscellaneous_fee);
        ws.cell(1, col++).string(title.tip);
        ws.cell(1, col++).string(title.toll);
        ws.cell(1, col++).string(title.driver_profit);
        ws.cell(1, col++).string(title.driver_tax);
        ws.cell(1, col++).string(title.driver_miscellaneous_fee);
        ws.cell(1, col++).string(title.pickup_address);
        ws.cell(1, col++).string(title.destination_address);

    array.forEach(function (data, index) {
        col = 1;
        
        ws.cell(index + 2, col++).number(data.unique_id);
        

        if (data.user_first_name || data.user_last_name) {
            ws.cell(index + 2, col++).string(data.user_first_name + ' ' + data.user_last_name);
        } else {
            col++   // We have to skip that particular column
        }
            
        if (data.provider_first_name || data.provider_last_name) {
            ws.cell(index + 2, col++).string(data.provider_first_name + ' ' + data.provider_last_name);
        } else {
            col++   // We have to skip that particular column
        }

        if(data.is_trip_cancelled == 1){
            ws.cell(index + 2, col++).string(title.title_cancelled);
        }else{
            ws.cell(index + 2, col++).string(title.title_completed);
        }

        ws.cell(index + 2, col++).string(data.vehicle_name);

        ws.cell(index + 2, col++).string(moment(data.created_at).tz(setting_detail.timezone_for_display_date).format('DD MMM YYYY HH:mm a'));
       
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
        ws.cell(index + 2, col++).number(data.base_distance_cost);
        ws.cell(index + 2, col++).number(data.total_distance);
        ws.cell(index + 2, col++).number(data.distance_cost);
        ws.cell(index + 2, col++).number(data.total_time);
        ws.cell(index + 2, col++).number(data.time_cost);
        ws.cell(index + 2, col++).number(data.total_waiting_time);
        ws.cell(index + 2, col++).number(data.waiting_time_cost);
        ws.cell(index + 2, col++).number(data.user_tax_fee);
        ws.cell(index + 2, col++).number(data.tax_fee);
        ws.cell(index + 2, col++).number(data.user_miscellaneous_fee);
        ws.cell(index + 2, col++).number(data.tip_amount);
        ws.cell(index + 2, col++).number(data.toll_amount);
        ws.cell(index + 2, col++).number(data.provider_profit_fees);
        ws.cell(index + 2, col++).number(data.provider_tax_fee);
        ws.cell(index + 2, col++).number(data.provider_miscellaneous_fee);
        ws.cell(index + 2, col++).string(data.source_address);
        ws.cell(index + 2, col++).string(data.destination_address);

        if (index == array.length - 1) {
            wb.write('data/xlsheet/' + typename + '_' + currentDate + '.xlsx', async function (err) {
                if (err) {
                    console.error(err);
                } else {
                    let url = setting_detail.history_base_url +"/xlsheet/" + typename + '_' + currentDate + '.xlsx';

                    if(res.json){
                        res.json(url);
                    }else{
                        res(url);
                    }
                }
            });
        }
    })
}

// excel sheet download
async function generate_excel(req, res, array, type , header) {
    let setting_detail = await Setting.findOne({},{history_base_url: 1,timezone_for_display_date:1})
    const currentDate = moment().tz(setting_detail.timezone_for_display_date).format('HHmm_DDMMYYYY');
    let wb = new xl.Workbook();
    let ws = wb.addWorksheet('sheet1');
    let col = 1;
    let typename;
    switch (type) {
        case '1':
            typename = 'Running_Trip';
            break;
        case '2':
            typename = 'Scheduled_Trip';
            break;
        case '3':
            typename = 'Completed_Trip';
            break;
        case 4:
            typename = 'Trip_history';
            break;
        case 12:
            typename = 'Partner_Completed_Trip';
            break;
        default:
            typename = 'Cancelled_Trip';
            break;
    }
    let title
            if(header){
                title = JSON.parse(header)
            }else{
                title = {
                    id : 'Trip ID',
                    user_id : 'UserId',
                    user : 'User',
                    driver_id : 'DriverId',
                    driver : 'Driver',
                    date : 'Date',
                    status : 'Status',
                    amount : 'Price',
                    payment : 'Payment',
                    payment_status : 'Payment Status',
                    title_status_cancel_by_provider : 'Cancelled By Provider',
                    title_status_cancel_by_user : 'Cancelled By User',
                    title_total_cancelled:'Cancelled',
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
        
        if(data?.unique_id){
            ws.cell(index + 2, col++).number(data.unique_id);
        }else{
            col++
        }
        
        if (data.user_details) {
            ws.cell(index + 2, col++).number(data.user_details.unique_id);
            ws.cell(index + 2, col++).string(data.user_details.first_name + ' ' + data.user_details.last_name);
        } else {
            col += 2
        }
            
        
        if (data.provider_details) {
            ws.cell(index + 2, col++).number(data.provider_details.unique_id);
            ws.cell(index + 2, col++).string(data.provider_details.first_name + ' ' + data.provider_details.last_name);
        } else {
            col += 2;
        }
        ws.cell(index + 2, col++).string(moment(data.created_at).tz(setting_detail.timezone_for_display_date).format('DD MMM YYYY HH:mm a'));
       
        if (data.is_trip_cancelled == 1) {
            if (data.is_trip_cancelled_by_provider == 1) {
                ws.cell(index + 2, col++).string(title.title_status_cancel_by_provider);
            } else if (data.is_trip_cancelled_by_user == 1) {
                ws.cell(index + 2, col++).string(title.title_status_cancel_by_user);
            } else {
                ws.cell(index + 2, col++).string(title.title_total_cancelled);
            }
        } else {
            if (data.is_provider_status == 2) {
                ws.cell(index + 2, col++).string(title.title_trip_status_coming);
            } else if (data.is_provider_status == 4) {
                ws.cell(index + 2, col++).string(title.title_trip_status_arrived);
            } else if (data.is_provider_status == 6) {
                ws.cell(index + 2, col++).string(title.title_trip_status_trip_started);
            } else if (data.is_provider_status == 9) {
                ws.cell(index + 2, col++).string(title.title_trip_status_completed);
            } else if (data.is_provider_status == 1 || data.is_provider_status == 0) {
                if (data.is_provider_accepted == 1) {
                    ws.cell(index + 2, col++).string(title.title_trip_status_accepted);
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
            wb.write('data/xlsheet/' + typename + '_' + currentDate + '.xlsx', async function (err) {
                if (err) {
                    console.error(err);
                } else {
                    let url = setting_detail.history_base_url +"/xlsheet/" + typename + '_' + currentDate + '.xlsx';

                    if(res.json){
                        res.json(url);
                    }else{
                        res(url);
                    }
                }
            });
        }
    })
}

// Excel sheet for downloading complete_trip_report for Open Ride
async function generate_excel_for_open_ride_complete_trip_report(req, res, array, type, header) {
    const setting_detail = await Setting.findOne({}, { history_base_url: 1, timezone_for_display_date: 1 })
    const currentDate = moment().tz(setting_detail.timezone_for_display_date).format('HHmm_DDMMYYYY')
    const wb = new xl.Workbook()
    const ws = wb.addWorksheet('sheet1')
    let col = 1
    const typename = 'complete_open_ride_report'
    let title
    
    if (header) {
        title = JSON.parse(header)
    } else {
        title = {
            id: 'Trip ID',
            // user_name: 'User',
            driver_name: 'Driver',
            vehicle_name: 'Service Type',
            status: 'Status',
            base_price: 'Base Price',
            distance: 'Distance',
            date: 'Date',
            amount: 'amount',
            payment: 'Payment',
            payment_status: 'Payment Status',
            title_pay_by_cash: 'Cash',
            title_pay_by_card: 'Card',
            title_pending: 'Pending',
            title_paid: 'Paid',
            title_not_paid: 'Not Paid',
            title_completed: 'Completed',
            title_cancelled: 'Cancelled',
            distance_price: 'Distance Price',
            time: 'Time',
            time_price: 'Time Price',
            waiting_time: 'Waiting Time',
            wait_time_price: 'Waiting Time Price',
            user_tax: 'User Tax',
            tax: 'Tax',
            user_miscellaneous_fee: 'User Miscellaneous Fee',
            tip: 'Tip',
            toll: 'Toll',
            driver_profit: 'Driver Profit',
            driver_tax: 'Driver Tax',
            driver_miscellaneous_fee: 'Driver Miscellaneous Fee',
            pickup_address: 'Pickup Address',
            destination_address: 'Destination Address'
        }

    }
    ws.cell(1, col++).string(title.id)
    ws.cell(1, col++).string(title.driver_name)
    ws.cell(1, col++).string(title.status)
    ws.cell(1, col++).string(title.vehicle_name)
    ws.cell(1, col++).string(title.date)
    ws.cell(1, col++).string(title.amount)
    ws.cell(1, col++).string(title.payment)
    ws.cell(1, col++).string(title.payment_status)
    ws.cell(1, col++).string(title.base_price)
    ws.cell(1, col++).string(title.distance)
    ws.cell(1, col++).string(title.distance_price)
    ws.cell(1, col++).string(title.time)
    ws.cell(1, col++).string(title.time_price)
    ws.cell(1, col++).string(title.user_tax)
    ws.cell(1, col++).string(title.tax)
    ws.cell(1, col++).string(title.user_miscellaneous_fee)
    ws.cell(1, col++).string(title.tip)
    ws.cell(1, col++).string(title.toll)
    ws.cell(1, col++).string(title.driver_profit)
    ws.cell(1, col++).string(title.driver_tax)
    ws.cell(1, col++).string(title.driver_miscellaneous_fee)
    ws.cell(1, col++).string(title.pickup_address)
    ws.cell(1, col++).string(title.destination_address)

    array.forEach(function (data, index) {
        col = 1
        ws.cell(index + 2, col++).number(data.unique_id)

        if (data.provider_details && (data.provider_details[0].first_name || data.provider_details[0].last_name)) {
            ws.cell(index + 2, col++).string(data.provider_details[0].first_name + ' ' + data.provider_details[0].last_name)
        } else {
            col++
        }

        if (data.is_trip_cancelled == 1 || data.is_trip_cancelled_by_provider == 1 || data.is_trip_cancelled_by_user == 1) {
            ws.cell(index + 2, col++).string(title.title_cancelled)
        } else {
            ws.cell(index + 2, col++).string(title.title_completed)
        }

        ws.cell(index + 2, col++).string(data.vehicle_name)

        ws.cell(index + 2, col++).string(moment(data.created_at).tz(setting_detail.timezone_for_display_date).format('DD MMM YYYY HH:mm a'))

        ws.cell(index + 2, col++).number(data.total)

        // Right now open ride is for CASH only so payment_mode property would be null
        if (data.payment_mode == 0) {
            ws.cell(index + 2, col++).string(title.title_pay_by_card)
        } else {
            ws.cell(index + 2, col++).string(title.title_pay_by_cash)
        }

        if (data.payment_status == 0) {
            ws.cell(index + 2, col++).string(title.title_pending)
        } else {
            if (data.payment_status == 1) {
                ws.cell(index + 2, col++).string(title.title_paid)
            } else {
                ws.cell(index + 2, col++).string(title.title_not_paid)
            }
        }
        ws.cell(index + 2, col++).number(data.base_distance_cost)
        ws.cell(index + 2, col++).number(data.total_distance)
        ws.cell(index + 2, col++).number(data.distance_cost)
        ws.cell(index + 2, col++).number(data.total_time)
        ws.cell(index + 2, col++).number(data.time_cost)
        ws.cell(index + 2, col++).number(data.user_tax_fee)
        ws.cell(index + 2, col++).number(data.tax_fee)
        ws.cell(index + 2, col++).number(data.user_miscellaneous_fee)
        ws.cell(index + 2, col++).number(data.tip_amount)
        ws.cell(index + 2, col++).number(data.toll_amount)
        ws.cell(index + 2, col++).number(data.provider_profit_fees)
        ws.cell(index + 2, col++).number(data.provider_tax_fee)
        ws.cell(index + 2, col++).number(data.provider_miscellaneous_fee)
        ws.cell(index + 2, col++).string(data.source_address)
        ws.cell(index + 2, col++).string(data.destination_address)

        if (index == array.length - 1) {
            wb.write('data/xlsheet/' + typename + '_' + currentDate + '.xlsx', async function (err) {
                if (err) {
                    console.error(err)
                } else {
                    const url = setting_detail.history_base_url + "/xlsheet/" + typename + '_' + currentDate + '.xlsx'

                    if (res.json) {
                        res.json(url)
                    } else {
                        res(url)
                    }
                }
            })
        }
    })
}

exports.get_export_history_list = async function (req, res) {
    let params_array = [{ name: "type", type: 'number' }, { name: "export_user_id", type: 'string' }]
    let response = await utils.check_request_params_async(req.body, params_array)
    if (!response.success) {
        res.json(response)
        return;
    }
    Export_history.find({type: req.body.type, export_user_id: req.body.export_user_id}).then((export_history_data) => {
        return res.json({ 
            success: true,export_history_data: export_history_data,
            success_message: "",
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
        });
    })

}

exports.delete_export_file = async function (req, res) {
    Export_history.findOne({unique_id: req.body.id}).then((export_history_data) => {
        let file_name = export_history_data.url;
        file_name = file_name.split('/').pop()
        fs.unlink('data/xlsheet/' + file_name, function () {
            Export_history.findByIdAndDelete(export_history_data._id).then((export_history)=>{
                return res.json({ 
                    success: true,
                    success_code: String(success_messages.MESSAGE_CODE_EXPORT_HISTORY_DELETE_SUCCESSFULLY),
                    success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_EXPORT_HISTORY_DELETE_SUCCESSFULLY),  
                });
            })
        });
    })
}

exports.user_history = async function(req,res){
    try{
        let params_trips = (req.body,[{name: 'user_id', type: 'string'}])
        let response = await utils.check_request_params_async(req.body, params_trips)
        if (!response.success) {
            res.json(response)
            return;
        }
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
            
            queue_manager.earningExportQueueOfUserHistory.add(request,{
                     jobId: Date.now()
                }).then((job) => {
                let export_history = new Export_history({
                    type: TRIP_LIST.USER_HISTORY,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id:req.body.export_user_id,
                    data: job.data
                })
                export_history.save()
                return res.json({ 
                    success: true,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE ),
                    success_message: ""  
                });
            });
            return;
        }
        mExportDataController.user_history_req_post(req, res);
    }catch(err){
        utils.error_response(err, req, res)
    }
}

//////////////////// user_history //////////////////////
exports.user_history_req_post = async function (req, res) {
    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }], function (response) {
        if (response.success) {
            if(!req.body){
                req.body = req;
            }
            User.findOne({ _id: req.body.user_id }).then((user) => {
                if (user.token != req.body.token) {
                    return res.json({ 
                        success: false,
                        error_code: String(error_message.ERROR_CODE_INVALID_TOKEN),
                        error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_INVALID_TOKEN),
                    });
                } else {

                    let Table 
                    let provider 
                    let condition
                    let condition1
                    let mongoose = require('mongoose');
                    let Schema = mongoose.Types.ObjectId;
                    if (req.body.is_open_ride) {
                        Table = OpenRide
                        provider = 'provider_id'
                        condition = { $match: {"user_details.user_id": Schema(req.body.user_id)} };
                        condition1 = { $match: { $or: [{ is_trip_cancelled: { $eq: 1 } }, { is_trip_end: { $eq: 1 } }, { "user_details.booking_cancelled_by_user": { $eq: 1 } }, { '"user_details.booking_cancelled_by_provider"': { $eq: 1 } }] } };
                    } else {
                        Table = Trip_history
                        provider = 'confirmed_provider'
                        condition = { $match: { 'user_id': { $eq: Schema(req.body.user_id) } } };
                        condition1 = { $match: { $or: [{ is_trip_cancelled: { $eq: 1 } }, { is_trip_end: { $eq: 1 } }, { is_trip_cancelled_by_user: { $eq: 1 } }, { is_trip_cancelled_by_provider: { $eq: 1 } }] } };
                    }

                    let lookup1 = {
                        $lookup:
                        {
                            from: "providers",
                            localField: provider,
                            foreignField: "_id",
                            as: "provider_detail"
                        }
                    };
                    let unwind1 = {
                        $unwind: {
                            path: "$provider_detail",
                            preserveNullAndEmptyArrays: true
                        }
                    };

                    let lookup2 = {
                        $lookup:
                        {
                            from: "trip_services",
                            localField: "trip_service_city_type_id",
                            foreignField: "_id",
                            as: "service_type"
                        }
                    };
                    let unwind2 = { $unwind: "$service_type" };

                    let group = {
                        $project: {
                            trip_id: '$_id', unique_id: 1, invoice_number: 1,
                            current_provider: 1, provider_service_fees: 1,
                            is_trip_cancelled_by_user: 1,
                            is_trip_completed: 1,
                            is_trip_cancelled: 1,
                            is_user_rated: 1,
                            is_provider_rated: 1,
                            is_trip_cancelled_by_provider: 1,
                            first_name: '$provider_detail.first_name',
                            last_name: '$provider_detail.last_name',
                            picture: '$provider_detail.picture',
                            total: 1,
                            unit: 1,
                            currency: 1,
                            currencycode: 1,
                            total_time: 1,
                            user_create_time: 1,
                            total_distance: 1,
                            source_address: 1,
                            destination_address: 1,
                            destination_addresses: 1,
                            provider_trip_end_time: 1,
                            timezone: 1,
                            created_at: 1,
                            cash_payment: 1,
                            card_payment: 1,
                            wallet_payment: 1,
                            service_type: 1,
                            payment_mode: 1
                        }
                    };

                    let search_item;
                    let search_value;
                    let sort_order;
                    let sort_field;
                    let value
                    let search
                    if (req.body.search_item == undefined) {
                        search_item = 'unique_id';
                        search_value = '';
                        sort_order = -1;
                        sort_field = 'unique_id';
                    } else {
                        value = req.body.search_value;
                        value = value.trim();
                        value = value.replace(/ +(?= )/g, '');
                        value = new RegExp(value, 'i');
                        sort_order = req.body.sort_item[1];
                        sort_field = req.body.sort_item[0];
                        search_item = req.body.search_item
                        search_value = req.body.search_value;
                    }

                    value = search_value;
                    value = value.trim();
                    value = value.replace(/ +(?= )/g, '');
                    let query1 = {};
                    let query2 = {};
                    let query3 = {};
                    let query4 = {};
                    let query5 = {};
                    let query6 = {};
                    if (search_item == "unique_id") {

                        query1 = {};
                        if (value != "") {
                            value = Number(value)
                            query1[search_item] = { $eq: value };
                            search = { "$match": query1 };
                        }
                        else {
                            search = { $match: {} };
                        }
                    } else if (search_item == "first_name") {
                        query1 = {};
                        query2 = {};
                        query3 = {};
                        query4 = {};
                        query5 = {};
                        query6 = {};

                        let full_name = value.split(' ');
                        if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {
                            query1['first_name'] = { $regex: new RegExp(full_name[0], 'i') };
                            query2['last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                            search = { "$match": { $or: [query1, query2] } };
                        } else {
                            query1[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                            query2['last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                            query3[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                            query4['last_name'] = { $regex: new RegExp(full_name[0], 'i') };
                            query5[search_item] = { $regex: new RegExp(full_name[1], 'i') };
                            query6['last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                            search = { "$match": { $or: [query1, query2, query3, query4, query5, query6] } };
                        }
                    } else {
                        search = { "$match": { search_item: { $regex: new RegExp(value, 'i') } } };
                    }


                    let start_date = req.body.start_date;
                    let end_date = req.body.end_date;
                    if (end_date == '' || end_date == undefined) {
                        end_date = new Date();
                    } else {
                        end_date = new Date(end_date);
                        end_date = end_date.setHours(23, 59, 59, 999);
                        end_date = new Date(end_date);
                    }

                    if (start_date == '' || start_date == undefined) {
                        start_date = new Date(0);
                        start_date = start_date.setHours(0, 0, 0, 0);
                        start_date = new Date(start_date);
                    } else {
                        start_date = new Date(start_date);
                        start_date = start_date.setHours(0, 0, 0, 0);
                        start_date = new Date(start_date);
                    }
                    query1['created_at'] = { $gte: start_date, $lt: end_date };
                    let filter = { "$match": query1 };

                    let number_of_rec = 10;
                    let skip = {};
                    let page = req.body.page
                    skip["$skip"] = (page - 1) * number_of_rec;

                    let limit = {};
                    limit["$limit"] = number_of_rec;

                    let sort = { "$sort": {} };
                    sort["$sort"][sort_field] = parseInt(sort_order);


                    Table.aggregate([condition, condition1, lookup1, unwind1, lookup2, unwind2, group, filter, search]).then((array) => {
                        let total_page = Math.ceil(array.length / 10)

                            if (req.body.is_export) {
                                generate_user_history_export_excel(req, res)
                                return
                            }
                        
                        if(req.body.page){
                            Table.aggregate([condition, condition1, lookup1, unwind1, lookup2, unwind2, group, filter, search, sort, skip, limit]).then((array_list) => {

                                if(res.json){

                                    return res.json({ 
                                        success: true,trips: array_list, pages: total_page,
                                        success_message: "",
                                        success_code: String(success_messages.DEFUALT_SUCCESS_CODE) 
                                    });
                                }
                                else{
                                    res({ 
                                        success: true,trips: array_list, pages: total_page,
                                        success_message: "",
                                        success_code: String(success_messages.DEFUALT_SUCCESS_CODE) 
                                    });

                                }
                            });
                        }else{
                            Table.aggregate([condition, condition1, lookup1, unwind1, lookup2, unwind2, group, filter, search, sort]).then((array_list) => {
 
                                return res.json({ 
                                    success: true,trips: array_list, pages: total_page,
                                    success_message: "",
                                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE) 
                                });
                            });
                        }
                    }, (err) => {
                        res.json({ 
                            success: false,
                            error_code: String(error_message.ERROR_CODE_SOMETHING_WENT_WRONG),
                            error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_SOMETHING_WENT_WRONG),
                        });
                    });
                }
            }, (err) => {
                res.json({ 
                    success: false,
                    error_code: String(error_message.ERROR_CODE_SOMETHING_WENT_WRONG),
                    error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_SOMETHING_WENT_WRONG),
                });
            });
        } else {
            res.json({ 
                success: false,
                error_code: String(response.error_code),
                error_message: response.error_message,
            });
        }
    });
}

async function generate_user_history_export_excel(req, res) {
    if(!req.body){
        req.body = req;
    }
    const currentDate = moment().tz(setting_detail.timezone_for_display_date).format('HHmm_DDMMYYYY');
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
        let unwind = { $unwind: "$user_detail" };

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
            if (value != "") {
                value = Number(value)
                query1[search_item] = { $eq: value };
                search = { "$match": query1 };
            } else {
                search = { $match: {} };
            }

        } else if (search_item == "provider_detail.first_name") {
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
            search = { "$match": { search_item: { $regex: new RegExp(value, 'i') } } };
        }

        let query1 = {};
        query1['created_at'] = { $gte: start_date, $lt: end_date };
        let filter = { "$match": query1 };

        let sort = { "$sort": {} };
        sort["$sort"][sort_field] = parseInt(sort_order);

        let mongoose = require('mongoose');
        let Schema = mongoose.Types.ObjectId;
        let condition = { $match: { 'user_id': { $eq: Schema(req.body.user_id) } } };
        Trip_history.aggregate([condition, lookup, unwind, lookup1, search, filter, sort]).then((array) => {

            let wb = new xl.Workbook();
            let ws = wb.addWorksheet('sheet1');
            let col = 1;

            let title
            if(req.body.header){
                title = req.body.header
            }else{
                title = {
                    id : 'Trip ID',
                    user_id : 'UserId',
                    user : 'User',
                    driver_id : 'DriverId',
                    driver : 'Driver',
                    date : 'Date',
                    status : 'Status',
                    amount : 'Price',
                    payment : 'Payment',
                    payment_status : 'Payment Status',
                    title_status_cancel_by_provider : 'Cancelled By Provider',
                    title_status_cancel_by_user : 'Cancelled By User',
                    title_total_cancelled : 'Cancelled',
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
                        ws.cell(index + 2, col++).string(title.title_total_cancelled);
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
                    wb.write('data/xlsheet/user_history_' + currentDate + '.xlsx', async function (err) {
                        if (err) {
                            console.error(err);
                        } else {
                            let setting_detail = await Setting.findOne({},{history_base_url: 1})
                            let url = setting_detail.history_base_url +  "/xlsheet/user_history_"+currentDate + '.xlsx';

                            if(res.json){
                                res.json(url);
                            }else{
                                res(url);
                            }
                        }
                    });
                }
            });
        }, (err) => {
            utils.error_response(err, req, res)
        });
}

/////////////GET FUTURE TRIP///////////
exports.getfuturetrip = function (req, res) {
    User.findOne({_id: req.body.user_id}, function (err, user) {
        if (user)
        {
            if (req.body.token != null && user.token != req.body.token) {
                return res.json({ 
                    success: false,
                    error_code: String(error_message.ERROR_CODE_INVALID_TOKEN),
                    error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_INVALID_TOKEN),
                });
            } else {
                let lookup2 = {
                    $lookup:
                        {
                            from: "trip_services",
                            localField: "trip_service_city_type_id",
                            foreignField: "_id",
                            as: "service_type"
                        }
                };
                let unwind2 = {$unwind: "$service_type"};
                let mongoose = require('mongoose');
                let Schema = mongoose.Types.ObjectId;
                let Table
                let condition
                let condition1
                let arr = []
                if (req.body.is_open_ride) {
                    Table = OpenRide
                    let unwind1 = {
                      $unwind: "$user_details",
                    };
                    condition = {
                      $match: { 
                        $and: [
                            {"user_details.user_id": Schema(req.body.user_id)},
                            {"user_details.booking_cancelled":{$eq: 0}},
                            {"user_details.booking_cancelled_by_user":{$eq: 0}},
                            {"user_details.booking_cancelled_by_provider":{$eq: 0}}
                        ]
                      },
                    };
                        
                     
                    condition1 = {$match: {$and: [{is_schedule_trip: {$eq: false}},{ is_provider_status: { $eq: 0 } },{is_trip_cancelled: {$eq: 0}}, {is_trip_completed: {$eq: 0}}, {is_trip_end: {$eq: 0}}]}};
                    arr.push(unwind1)
                } else {
                    Table = Trip
                    condition = {$match: {'user_id': {$eq: Schema(req.body.user_id)}}};
                    condition1 = {$match: {$and: [{is_schedule_trip: {$eq: true}},{is_trip_cancelled: {$eq: 0}}, {is_trip_completed: {$eq: 0}}, {is_trip_end: {$eq: 0}} , {provider_id: {$eq: null}},{find_nearest_provider_time:null}]}};
                }
                arr.push(condition)
                arr.push(condition1)
                arr.push(lookup2,unwind2)

                Table.aggregate(arr, function (err, scheduledtrip) {
                    if (err || scheduledtrip.length === 0) {
                        return res.json({ 
                            success: false,
                            error_code: String(error_message.ERROR_CODE_NO_SCHEDULED_TRIP_FOUND),
                            error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_NO_SCHEDULED_TRIP_FOUND),
                        });

                    } else {
                        return res.json({ 
                            success: true,scheduledtrip: scheduledtrip,
                            success_code: String(success_messages.MESSAGE_CODE_GET_YOUR_FUTURE_TRIP_SUCCESSFULLY),
                            success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_GET_YOUR_FUTURE_TRIP_SUCCESSFULLY),  
                        });
                    }
                });
            }
        } else {
            return res.json({ 
                success: false,
                error_code: String(error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND),
                error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND),
            });
        }
    });
};

exports.provider_history = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        if (req.body.is_export) {
            req.body.host = req.get('host')
            req.body.protocol = req.protocol
            let request = {
                body: req.body,
                headers: {
                    is_show_email: req.headers.is_show_email,
                    is_show_phone: req.headers.is_show_phone,
                }
            }
            queue_manager.earningExportQueueOfProviderHistory.add(request,{
                     jobId: Date.now()
                }).then((job) => {
                let export_history = new Export_history({
                    type: TRIP_LIST.PROVIDER_HISTORY,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id:req.body.export_user_id,
                    data: job.data
                })
                export_history.save();
                res.json({ 
                    success: true,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: ""
                });
            });
            return;
        }
        mExportDataController.provider_history_req_body(req, res);
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

/////////////////////// provider_history ///////////////////////////////////
exports.provider_history_req_body = async function (req, res) {
    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }], async function (response) {
        if (!req.body) {
            req.body = req
        }
        if (!response.success) {
            return res.json({ 
                success: false,
                error_code: String(response.error_code),
                error_message: response.error_message,
            });
        }

        let provider = await Provider.findById(req.body.provider_id)
        if (!provider) {
            return res.json({ 
                success: false,
                error_code: String(error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND),
                error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND),
            });
        }

        if (provider.token != req.body.token) {
            return res.json({ 
                success: false,
                error_code: String(error_message.ERROR_CODE_INVALID_TOKEN),
                error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_INVALID_TOKEN),
            });
        }
        let lookup1 = {
            $lookup:
            {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user_detail"
            }
        };
        let unwind1 = { $unwind: "$user_detail" };

        let promo_lookup = {
            $lookup: {
                from: 'promo_codes',
                localField: 'promo_id',
                foreignField: '_id',
                as: 'promo_detail'
            }
        }
        let promo_unwind = {
            $unwind: {
                path: "$promo_detail",
                preserveNullAndEmptyArrays: true
            }
        };

        let mongoose = require('mongoose');
        let Schema = mongoose.Types.ObjectId;

        let condition = { $match: { 'confirmed_provider': { $eq: Schema(req.body.provider_id) } } };

        let group = {
            $project: {
                trip_id: '$_id', unique_id: 1, invoice_number: 1,
                current_provider: 1,
                is_trip_cancelled_by_user: 1,
                is_trip_cancelled: 1,
                is_user_rated: 1,
                is_trip_completed: 1,
                is_provider_rated: 1,
                is_trip_cancelled_by_provider: 1,
                first_name: '$user_detail.first_name',
                last_name: '$user_detail.last_name',
                picture: '$user_detail.picture',
                promocode: '$promo_detail.promocode',
                total: 1,
                unit: 1,
                currency: 1,
                currencycode: 1,
                total_time: 1,
                user_create_time: 1,
                total_distance: 1,
                source_address: 1,
                destination_address: 1,
                destination_addresses: 1,
                provider_trip_end_time: 1,
                timezone: 1,
                created_at: 1,
                payment_mode: 1,
                payment_status: 1,
                sourceLocation: 1,
                destinationLocation: 1,
                // for invoice price details
                base_distance_cost: 1,
                distance_cost: 1,
                time_cost: 1,
                total_waiting_time: 1,
                surge_fee: 1,
                tax_fee: 1,
                total_service_fees: 1,
                user_tax_fee: 1,
                user_miscellaneous_fee: 1,
                tip_amount: 1,
                toll_amount: 1,
                promo_payment: 1,
                wallet_payment: 1,
                card_payment: 1,
                cash_payment: 1,
                remaining_payment: 1,
                provider_profit_fees: 1,
                provider_miscellaneous_fee: 1,
                provider_service_fees: 1,
                provider_tax_fee: 1,
                fixed_price: 1,
                total_after_surge_fees: 1,
                total_after_tax_fees: 1,
                provider_arrived_time: 1,
                provider_trip_start_time: 1,
                waiting_time_cost: 1,
                is_trip_end: 1,
                trip_type : 1,
                is_fixed_fare : 1,
                is_min_fare_used :1,
                split_payment_users : 1,
                trip_status:1

            }
        };

        // pangination and filter
        let search_item;
        let search_value;
        let sort_order;
        let sort_field;
        let value;
        let search;
        if (req.body.search_item == undefined) {
            search_item = 'unique_id';
            search_value = '';
            sort_order = -1;
            sort_field = 'unique_id';
        } else {
            value = req.body.search_value;
            value = value.trim();
            value = value.replace(/ +(?= )/g, '');
            value = new RegExp(value, 'i');
            sort_order = req.body.sort_item[1];
            sort_field = req.body.sort_item[0];
            search_item = req.body.search_item
            search_value = req.body.search_value;
        }

        value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');
        let query1 = {};
        let query2 = {};
        let query3 = {};
        let query4 = {};
        let query5 = {};
        let query6 = {};

        if (search_item == "unique_id") {

            query1 = {};
            if (value != "") {
                value = Number(value)
                query1[search_item] = { $eq: value };
                search = { "$match": query1 };
            }
            else {
                search = { $match: {} };
            }
        } else if (search_item == "first_name") {
            query1 = {};
            query2 = {};
            query3 = {};
            query4 = {};
            query5 = {};
            query6 = {};

            let full_name = value.split(' ');
            if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {
                query1[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                query2['last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                search = { "$match": { $or: [query1, query2] } };
            } else {
                query1[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                query2['last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                query3[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                query4['last_name'] = { $regex: new RegExp(full_name[0], 'i') };
                query5[search_item] = { $regex: new RegExp(full_name[1], 'i') };
                query6['last_name'] = { $regex: new RegExp(full_name[1], 'i') };

                search = { "$match": { $or: [query1, query2, query3, query4, query5, query6] } };
            }
        } else {
            search = { "$match": { search_item: { $regex: new RegExp(value, 'i') } } };
        }

        let start_date = req.body.start_date;
        let end_date = req.body.end_date;
        if (end_date == '' || end_date == undefined) {
            end_date = new Date();
        } else {
            end_date = new Date(end_date);
            end_date = end_date.setHours(23, 59, 59, 999);
            end_date = new Date(end_date);
        }

        if (start_date == '' || start_date == undefined) {
            start_date = new Date(0);
            start_date = start_date.setHours(0, 0, 0, 0);
            start_date = new Date(start_date);
        } else {
            start_date = new Date(start_date);
            start_date = start_date.setHours(0, 0, 0, 0);
            start_date = new Date(start_date);
        }

        query1['created_at'] = { $gte: start_date, $lt: end_date };
        let filter = { "$match": query1 };

        let number_of_rec = 10;
        let page = req.body.page || 1;
        let skip = {};
        skip["$skip"] = (page - 1) * number_of_rec;

        let limit = {};
        limit["$limit"] = number_of_rec;
        let sort = { "$sort": {} };
        sort["$sort"][sort_field] = parseInt(sort_order);
        /* Count Total Trips */
        let trips_total = await Trip_history.aggregate([condition, lookup1, unwind1, promo_lookup, promo_unwind, group, filter, search, sort]);
        let total_pages = Math.ceil(trips_total.length / number_of_rec)

        let trips = await Trip_history.aggregate([condition, lookup1, unwind1, promo_lookup, promo_unwind, group, filter, search, sort, skip, limit]);
        if (req.body.is_export) {
            provider_history_export_excel(req, res)
        }else{

            return res.json({ 
                success: true,trips: trips, page: total_pages, 
                success_code: String(success_messages.DEFUALT_SUCCESS_CODE),  
                success_message: "",
            });
        }
        
    })
};

function provider_history_export_excel(req, res) {
    if(req.body.search_item == 'first_name'){
        req.body.search_item = 'user_detail.first_name'
    }
    if (typeof req.body.provider_id == 'undefined') {
        res.redirect('/provider_login');
    } else {
        const currentDate = moment().tz(setting_detail.timezone_for_display_date).format('HHmm_DDMMYYYY');
        let value;
        let search_item = 'unique_id';
        let search_value = '';
        let sort_order = -1;
        let sort_field = 'unique_id';
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
                title_total_cancelled : 'Cancelled',
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
                    ws.cell(index + 2, col++).string(title.title_total_cancelled);
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
                wb.write('data/xlsheet/provider_history_'+currentDate + '.xlsx', async function (err) {
                    if (err) {
                        console.error(err);
                    } else {
                        let setting_detail = await Setting.findOne({},{history_base_url: 1})
                            let url = setting_detail.history_base_url +  "/xlsheet/provider_history_"+currentDate + '.xlsx';


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

exports.complete_request = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        if (req.query.is_excel_sheet) {
            req.body.host = req.get('host')
            req.body.protocol = req.protocol
            let request = {
                query: req.query,
                headers: {
                    is_show_email: req.headers.is_show_email,
                    is_show_phone: req.headers.is_show_phone,
                }
            }
            queue_manager.tripExportQueueForPartnerCompleteRide.add(request,{
                     jobId: Date.now()
                }).then((job) => {
                let export_history = new Export_history({
                    type: req.query.trip_type,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id:req.query.export_user_id,
                    data: job.data,
                })
                export_history.save();
                res.json({ 
                    success: true,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: ""  
                });
            });
            return;
        }
        mExportDataController.complete_request_req_post(req, res);

    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.complete_request_req_post = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        mExportDataController.get_trip_data(req, res)
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.history_in_corporate = async function(req,res){
    try{
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
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
            queue_manager.earningExportQueueOfCorporateCompleteRide.add(request,{
                     jobId: Date.now()
                }).then((job) => {
                let export_history = new Export_history({
                    type: req.body.type,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id:req.body.export_user_id,
                    data: job.data
                })
                export_history.save()
                res.json({ 
                    success: true,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: ""
                });
            });
            return;
        }
        mExportDataController.history_req_post_in_corporate(req, res);

    }catch(err){
        utils.error_response(err, req, res)
    }
}

exports.history_req_post_in_corporate = async function (req, res) {
    try {

        if (!req.body) {
            req.body = req
        }
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        
        let page
        let sort_field
        let sort_order
        let start_date
        let end_date
        let search_item
        let search_value
        let filter_start_date
        let filter_end_date
        let search
        if (req.body.page == undefined) {
            page = 0;
        } else {
            page = req.body.page;
        }
        
        if(req.body.search_item == undefined){
            sort_field = 'unique_id'
            sort_order = -1
            start_date = ''
            end_date = ''
            filter_start_date = ''
            filter_end_date = ''
            search_item = 'user_detail.first_name'
            search_value = ''
        }else{
            sort_field = req.body.sort_item[0]
            sort_order = req.body.sort_item[1]
            filter_start_date = req.body.start_date
            filter_end_date = req.body.end_date
            search_item = req.body.search_item
            search_value = req.body.search_value
        }
        
        // date query
        if(filter_start_date == '' ||filter_end_date == ''){
            if(filter_start_date == '' && filter_end_date == ''){
                start_date = new Date(0);
                end_date = new Date(Date.now());
                end_date = end_date.setHours(23, 59, 59, 999);
                end_date = new Date(end_date);
            }else if(filter_start_date != '' && filter_end_date == ''){
                start_date = new Date(filter_start_date)
                start_date = start_date.setHours(0,0,0,0)
                start_date = new Date(start_date)
                end_date = new Date(Date.now())
                end_date = end_date.setHours(23, 59, 59, 999);
                end_date = new Date(end_date);
            }else{
                end_date = new Date(filter_end_date)
                end_date = end_date.setHours(23,59,59,999)
                end_date = new Date(end_date)
                start_date = new Date(0)
            }
        }else if (filter_start_date == undefined || filter_end_date == undefined){
            start_date = new Date(0);
            end_date = new Date(Date.now());
            end_date = end_date.setHours(23, 59, 59, 999);
            end_date = new Date(end_date);
        }else{
            start_date = new Date(req.body.start_date) 
            start_date = start_date.setHours(0,0,0,0)
            start_date = new Date(start_date)
            end_date = new Date(req.body.end_date) 
            end_date = end_date.setHours(23,59,59,999)
            end_date = new Date(end_date)
        }
    
        // search query
        let value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');
    
        if (search_item == "user_detail.first_name") {
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
        } else if (search_item == "provider_detail.first_name") {
            let query1 = {};
            let query2 = {};
            let query3 = {};
            let query4 = {};
            let query5 = {};
            let query6 = {};
    
            let full_name = value.split(' ');
            if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {
    
                query1[search_item] = {$regex: new RegExp(value, 'i')};
                query2['provider_detail.last_name'] = {$regex: new RegExp(value, 'i')};
    
                search = {"$match": {$or: [query1, query2]}};
            } else {
    
                query1[search_item] = {$regex: new RegExp(value, 'i')};
                query2['provider_detail.last_name'] = {$regex: new RegExp(value, 'i')};
                query3[search_item] = {$regex: new RegExp(full_name[0], 'i')};
                query4['provider_detail.last_name'] = {$regex: new RegExp(full_name[0], 'i')};
                query5[search_item] = {$regex: new RegExp(full_name[1], 'i')};
                query6['provider_detail.last_name'] = {$regex: new RegExp(full_name[1], 'i')};
    
                search = {"$match": {$or: [query1, query2, query3, query4, query5, query6]}};
            }
        } else {
            search = {"$match": {'unique_id': parseInt(search_value)}};
        }

        // for user
        let user_lookup = {
            $lookup : {
                from:'users',
                localField:'user_id',
                foreignField:'_id',
                as:'user_detail'
            }
        }
        let user_unwind = {
            $unwind : {
                path:'$user_detail',
                preserveNullAndEmptyArrays : true
            }
        }
    
        // for provider
        let proivder_lookup = {
            $lookup : {
                from:'providers',
                localField:'confirmed_provider',
                foreignField:'_id',
                as:'provider_detail'
            }
        }
        let provider_unwind = {
            $unwind : {
                path :'$provider_detail',
                preserveNullAndEmptyArrays:true
            }
        }
        
    
        // date filter 
        let filter = {$match : {'created_at':{$gte:start_date,$lt:end_date}}}
        let condition 
        // match condition
        if (req.body.type == TRIP_LIST.COMPLETED_TRIP_OF_CORPORATE) {
            condition = {$match:{'user_type_id':Schema(req.body.corporate_id)}}
        }else if (req.body.type == TRIP_LIST.COMPLETED_TRIP_OF_HOTEL) {
            condition = {$match:{'user_type_id':Schema(req.body.hotel_id)}}
        } else {
            condition = {$match:{'user_type_id':Schema(req.body.dispatcher_id)}}
        }
        // page limit skip sort done
        let limit = {$limit:10}
        let skip = {$skip:req.body.page*10}
        let sort = {$sort:{[sort_field] : parseInt(sort_order)}}
    
        
        console.log(JSON.stringify(filter, null, 4))
        let total_trip = await Trip_history.aggregate([filter, condition,user_lookup, user_unwind, proivder_lookup, provider_unwind, search])
        let total_page = Math.ceil(total_trip.length / 10)
        let trip_details = await Trip_history.aggregate([filter, condition,user_lookup, user_unwind, proivder_lookup, provider_unwind, search, sort, skip, limit])

         if (req.body.is_export) {
            generate_request_excel(req, res)
            return
        } else {
            if (res.json) {
                res.json({ 
                    success: true, detail: trip_details,'current_page': page,'total_pages': total_page,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: "",  
                });
            }else{   
                res({ 
                    success: true, detail: trip_details,'current_page': page,'total_pages': total_page,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: "",  
                });
            }
        }
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

async function generate_request_excel(req,res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        const currentDate = moment().tz(setting_detail.timezone_for_display_date).format('HHmm_DDMMYYYY');
        // code 
        let page;
        let search_item;
        let search_value;
        let sort_order;
        let sort_field;
        let value
        let request
        let start_date
        let end_date
        let search
        if (req.body.page == undefined) {
            page = 0;
        } else {
            page = req.body.page;
        }
        
        if (req.body.search_item == undefined) {
            search_item = 'user_detail.first_name';
            search_value = '';
            sort_order = -1;
            sort_field = 'unique_id';
        } else {
            request = req.body.request;
            value = req.body.search_value;
            value = value.trim();
            value = value.replace(/ +(?= )/g, '');
            value = new RegExp(value, 'i');
            sort_order = req.body.sort_item[1];
            sort_field = req.body.sort_item[0];
            search_item = req.body.search_item
            search_value = req.body.search_value;
        }
        
        let Table = Trip_history
        if (request == 'corporate_request') {
            Table = Trip;
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

        let number_of_rec = 10;
        
        let lookup = {
            $lookup:
            {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user_detail"
            }
        };
        let unwind = { $unwind: "$user_detail" };

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

        if (search_item == "user_detail.first_name") {
            let query1 = {};
            let query2 = {};
            let query3 = {};
            let query4 = {};
            let query5 = {};
            let query6 = {};

            let full_name = value.split(' ');
            if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['user_detail.last_name'] = { $regex: new RegExp(value, 'i') };

                search = { "$match": { $or: [query1, query2] } };
            } else {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['user_detail.last_name'] = { $regex: new RegExp(value, 'i') };
                query3[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                query4['user_detail.last_name'] = { $regex: new RegExp(full_name[0], 'i') };
                query5[search_item] = { $regex: new RegExp(full_name[1], 'i') };
                query6['user_detail.last_name'] = { $regex: new RegExp(full_name[1], 'i') };

                search = { "$match": { $or: [query1, query2, query3, query4, query5, query6] } };
            }
        } else if (search_item == "provider_detail.first_name") {
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
            search = { "$match": { search_item: { $regex: new RegExp(value, 'i') } } };
        }

        let filter = { "$match": {} };
        filter["$match"]['created_at'] = { $gte: start_date, $lt: end_date };

        let sort = { "$sort": {} };
        sort["$sort"][sort_field] = parseInt(sort_order);


        let skip = {};
        skip["$skip"] = page * number_of_rec;

        let limit = {};
        limit["$limit"] = number_of_rec;
        let mongoose = require('mongoose');
        let Schema = mongoose.Types.ObjectId;

        let request_type
        let condition
        if (req.body.type == TRIP_LIST.COMPLETED_TRIP_OF_CORPORATE) {
            condition = { $match: { 'user_type_id': { $eq: Schema(req.body.corporate_id) } } };
            request_type = "corporate_request"
        }else if (req.body.type == TRIP_LIST.COMPLETED_TRIP_OF_HOTEL) {
            condition = { $match: { 'user_type_id': { $eq: Schema(req.body.hotel_id) } } };
            request_type = "hotel_request"
        }else {
            condition = { $match: { 'user_type_id': { $eq: Schema(req.body.dispatcher_id) } } };
            request_type = "dispatcher_request"
        }
        Table.aggregate([filter, condition, lookup, unwind, lookup1, search, sort]).then((array) => {
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
                    title_total_cancelled:"Cancelled",
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
                ws.cell(index + 2, col++).string(moment(data.created_at).tz(setting_detail.timezone_for_display_date).format('DD MMM YYYY HH:mm a'));

                if (data.is_trip_cancelled == 1) {
                    if (data.is_trip_cancelled_by_provider == 1) {
                        ws.cell(index + 2, col++).string(title.title_status_cancel_by_provider);
                    } else if (data.is_trip_cancelled_by_user == 1) {
                        ws.cell(index + 2, col++).string(title.title_status_cancel_by_user);
                    } else {
                        ws.cell(index + 2, col++).string(title.title_total_cancelled);
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
                    wb.write('data/xlsheet/' + request_type +'_'+ currentDate + '.xlsx', async function (err) {
                        if (err) {
                            console.error(err);
                        } else {
                            let setting_detail = await Setting.findOne({},{history_base_url: 1})
                            let url = setting_detail.history_base_url +  "/xlsheet/"  + request_type +'_'+currentDate + '.xlsx';
                            if(res.json){
                                res.json(url);
                            }else{
                                res(url);
                            }
                        }
                    });
                }
            })
        });
    
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.future_request_in_corporate = async function (req, res) {  
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        
        let corporate
        if (req.body.type == TRIP_LIST.COMPLETED_TRIP_OF_CORPORATE) {
            // code 
            corporate = await Corporate.findById(req.body.corporate_id)
            if(!corporate){
                let error_code = TYPE_ERROR_CODE.DETAIL_NOT_FOUND
                res.json({ 
                    success: false,
                    error_code: String(error_code),
                    error_message: utils.get_response_message(req.headers.lang_code, false, error_code),
                });
                return
            } 
        }


        let page;
        let next;
        let pre;
        let search_item;
        let search_value;
        let sort_order;
        let sort_field;
        let filter_start_date;
        let filter_end_date;
        let value
        let search
        let start_date
        let end_date
        let query1 = {};
        let query2 = {};
        let query3 = {};
        let query4 = {};
        let query5 = {};
        let query6 = {};
        
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
            search_item = 'user_detail.first_name';
            search_value = '';
            sort_order = -1;
            sort_field = 'unique_id';
            filter_start_date = '';
            filter_end_date = '';

        } else {
            value = req.body.search_value;
            value = value.trim();
            value = value.replace(/ +(?= )/g, '');
            value = new RegExp(value, 'i');


            sort_order = req.body.sort_item[1];
            sort_field = req.body.sort_item[0];
            search_item = req.body.search_item
            search_value = req.body.search_value;
            filter_start_date = req.body.start_date;
            filter_end_date = req.body.end_date;

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

        let number_of_rec = 10;

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

        value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');

        if (search_item == "user_detail.first_name") { 
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
        let filter = {"$match": query1};

        let sort = {"$sort": {}};
        sort["$sort"][sort_field] = parseInt(sort_order);

        let count = {$group: {_id: null, total: {$sum: 1}, data: {$push: '$data'}}};

        let skip = {};
        skip["$skip"] = page * number_of_rec;

        let limit = {};
        limit["$limit"] = number_of_rec;
        let mongoose = require('mongoose');
        let Schema = mongoose.Types.ObjectId;

        let condition = {$match: {'is_schedule_trip': {$eq: true}}};
        let condition1 = {$match: {'is_trip_cancelled': {$eq: 0}}};
        let condition2 = {$match: {'is_trip_completed': {$eq: 0}}};
        let condition3 = {$match: {'is_trip_end': {$eq: 0}}};
        let condition4 = {$match: {'provider_id': {$eq: null}}};
        let corporate_type_condition
        if (req.body.type == TRIP_LIST.COMPLETED_TRIP_OF_CORPORATE) {
            corporate_type_condition = {$match: {'user_type_id': {$eq: Schema(req.body.corporate_id)}}};
        }else if (req.body.type == TRIP_LIST.COMPLETED_TRIP_OF_HOTEL) {
            corporate_type_condition = {$match: {'user_type_id': {$eq: Schema(req.body.hotel_id)}}};
        }else if (req.body.type == TRIP_LIST.SCHEDULED_TRIP_OF_PARTNER){
            corporate_type_condition = {$match: {provider_type_id: Schema(req.body.partner_id)}};
            condition4 = {$match:{}}
        }else {
            corporate_type_condition = {$match: {'user_type_id': {$eq: Schema(req.body.dispatcher_id)}}};
        }
        if (req.body.type == TRIP_LIST.COMPLETED_TRIP_OF_CORPORATE) {
            let country_data = await Country.findOne({_id: corporate.country_id})
            if (!country_data) {
                let error_code = TYPE_ERROR_CODE.DETAIL_NOT_FOUND
                res.json({ 
                    success: false,
                    error_code: String(error_code),
                    error_message: utils.get_response_message(req.headers.lang_code, false, error_code),
                });
                return
            }
        }
        
        let vehicle_type_lookup = {
            $lookup: {
                from: 'types',
                localField: 'type_id',
                foreignField: '_id',
                pipeline: [{ $project: { _id: 1, typename: 1, unique_id: 1 } }],
                as: 'vehicle_type_details'
            }
        }
        let vehicle_unwind = { $unwind: "$vehicle_type_details"}

        let array = await Trip.aggregate([corporate_type_condition, condition, condition1, condition2, condition3, condition4, lookup, unwind, vehicle_type_lookup, vehicle_unwind,  search, filter, count])


        if (array.length == 0) {
            res.json({ 
                success: true, detail: array, 'current_page': 1, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date, success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                success_message: "",  
            });
            return
        }
        
        let pages = Math.ceil(array[0].total / number_of_rec);
        let detail = await Trip.aggregate([corporate_type_condition, condition, condition1, condition2, condition3, condition4, lookup, unwind, vehicle_type_lookup, vehicle_unwind, search, filter, sort, skip, limit])
        
        return res.json({ 
            success: true, detail: detail, 'current_page': page, 'pages': pages, 'next': next, 'pre': pre, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date, success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message: "",
        });
            
        
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.service_type_trip_list = async function (req, res) {
    try {
        let params_array = [{ name: 'user_type_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        if (req.query.is_excel_sheet) {
            req.body.host = req.get('host')
            req.body.protocol = req.protocol
            let request = {
                query: req.query,
                headers: {
                    is_show_email: req.headers.is_show_email,
                    is_show_phone: req.headers.is_show_phone,
                }
            }
            queue_manager.tripExportQueueForTripHistory.add(request,{
                     jobId: Date.now()
                }).then((job) => {
                let export_history = new Export_history({
                    type: req.query.export_history_type,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id:req.query.export_user_id,
                    data: job.data
                })
                export_history.save();
                res.json({ 
                    success: true,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: ""
                });
            });
            return;
        }
        mExportDataController.service_type_trip_list_req_post(req, res);
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.service_type_trip_list_req_post = async function (req, res) {
    try {
        let params_array = [{ name: 'user_type_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        if (!req.query) {
            req.query = req
        }
        // code 
        let limit = Number(req.query.limit)
        let page = Number(req.query.page) - 1
        let search_by = req.query.search_by
        let search_value = req.query.search_value
        let user_type_id = req.query.user_type_id
        let type = req.query.type
        let start_date = req.query.start_date
        let end_date = req.query.end_date
        let sort_item = req.query.sort_item
        let sort_order = Number(req.query.sort_order)
        let payment_mode = Number(req.query.payment_mode)
        let payment_condition = { $match: { payment_mode: { $eq: payment_mode } } }

        let condition = {}
        condition = {
            $match: { $or: [{ user_type_id: Schema(user_type_id) }, { provider_type_id: Schema(user_type_id) }, { user_id: Schema(user_type_id) }, { provider_id: Schema(user_type_id) }] }
        }

        if (payment_mode == undefined || payment_mode == 2) {
            payment_condition = { $match: {} }
        }

        let search = {}
        if (search_by && search_value) {
            let searches = search_by.split('.')
            if (search_by == 'unique_id') {
                search_value = Number(req.query.search_value)
                search[search_by] = search_value
            } else {
                search[search_by] = { $regex: search_value, $options: 'i' }
                let search_name = !search_by.includes('typename')
                if (search_name) {
                    search = {
                        $or: [
                            {
                                [search_by]: { $regex: search_value, $options: 'i' },
                            },
                            {
                                [searches[0] + '.last_name']: { $regex: search_value, $options: 'i' },
                            }
                        ]
                    }
                }
                let value = search_value.split(' ')
                if (type != 4 && type != 5 && value.length > 1 && search_name) {
                    search = {}
                    search[search_by] = { $regex: value[0], $options: 'i' }
                    search[searches[0] + '.last_name'] = { $regex: value[1], $options: 'i' }
                }
            }
        }
        let date_filter = { $match: {} }
        if (start_date && end_date) {
            start_date = new Date(start_date);
            end_date = new Date(end_date);
            end_date = end_date.setHours(23, 59, 59, 999);
            end_date = new Date(end_date);

            const setting_detail = await Settings.findOne({});



            start_date = utils.get_date_in_city_timezone(start_date,setting_detail.timezone_for_display_date)
            start_date = moment(start_date).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
            start_date = new Date(start_date)
    
    
            end_date = utils.get_date_in_city_timezone(end_date,setting_detail.timezone_for_display_date)
            end_date = moment(end_date).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
            end_date = new Date(end_date)
            

            date_filter = { "$match": { 'created_at': { $gte: start_date, $lt: end_date } } };
        }

        let Project = {
            $project: {
                provider_id: 1,
                unique_id: 1,
                total: 1,
                is_provider_status: 1,
                payment_mode: 1,
                is_trip_completed: 1,
                complete_date_in_city_timezone: 1,
                user_create_time: 1,
                is_trip_cancelled: 1,
                is_trip_cancelled_by_user: 1,
                is_trip_cancelled_by_provider: 1,
                is_provider_accepted: 1,
                payment_status: 1,
                "user_detail._id": "$user_id",
                "user_detail.first_name": "$user_first_name",
                "user_detail.last_name": "$user_last_name",
                "user_detail.unique_id": { $ifNull: ["$user_unique_id", 0] },
                "provider_details._id": "$provider_id",
                "provider_details.first_name": "$provider_first_name",
                "provider_details.last_name": "$provider_last_name",
                "provider_details.unique_id": { $ifNull: ["$provider_unique_id", 0] },
                "vehicle_details._id": "$type_id",
                "vehicle_details.typename": { $ifNull: ["$typename", "***"] },
                server_start_time_for_schedule: 1,
                provider_trip_end_time: 1,
                created_at: 1
            }
        }

        if (req.query.is_excel_sheet) {
            Project = {
                $project: {
                    provider_id: 1,
                    unique_id: 1,
                    total: 1,
                    is_provider_status: 1,
                    payment_mode: 1,
                    is_trip_completed: 1,
                    complete_date_in_city_timezone: 1,
                    user_create_time: 1,
                    is_trip_cancelled: 1,
                    is_trip_cancelled_by_user: 1,
                    is_trip_cancelled_by_provider: 1,
                    is_provider_accepted: 1,
                    payment_status: 1,
                    "user_details.first_name": "$user_first_name",
                    "user_details.last_name": "$user_last_name",
                    "user_details.unique_id": { $ifNull: ["$user_unique_id", 0] },
                    "provider_details.first_name": "$provider_first_name",
                    "provider_details.last_name": "$provider_last_name",
                    "provider_details.unique_id": { $ifNull: ["$provider_unique_id", 0] },
                    server_start_time_for_schedule: 1,
                    provider_trip_end_time: 1,
                    created_at: 1
                }
            }
        }

        let sort = {}
        if (sort_item && sort_order) {
            sort = {
                $sort: {
                    [sort_item]: sort_order
                }
            }
        } else {
            sort = { $sort: { unique_id: -1 } }
        }
        let count
        let pagination
        if (page !== null) {
            let number_of_rec = limit;
            let start = ((page + 1) * number_of_rec) - number_of_rec;
            let end = number_of_rec;
            count = { $group: { _id: null, total: { $sum: 1 }, result: { $push: "$$ROOT" } } };

            if (req.query.is_excel_sheet) {
                pagination = { $project: { total: { $ceil: { $divide: ['$total', limit] } }, data: '$result'   } }
            } else {
                pagination = { $project: { total: { $ceil: { $divide: ['$total', limit] } }, data: { $slice: ['$result', start, end] } } }
            }

        } else {
            count = { $group: { _id: null, total: { $sum: 1 }, result: { $push: "$$ROOT" } } };
            pagination = { $project: { total: 1, data: '$result' } }
        }

        let trip_list = await Trip_history.aggregate([condition, payment_condition, Project, { $match: search }, date_filter, sort, count, pagination])
        if (req.query.is_excel_sheet) {
            let type = 4
            generate_excel(req, res, trip_list[0].data, type , req.query.header)
            return
        }

        res.json({ 
            success: true, trip_list: trip_list, success_code: String(success_messages.DEFUALT_SUCCESS_CODE),success_message: "",  
        });

    } catch (error) {
        utils.error_response(error, req, res)
    }
}





// open ride 

exports.openride_user_history = async function(req,res){
    try{
        let params_trips = (req.body,[{name: 'user_id', type: 'string'}])
        let response = await utils.check_request_params_async(req.body, params_trips)
        if (!response.success) {
            res.json(response)
            return;
        }
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
            
            queue_manager.earningExportQueueOfOpenRideUserHistory.add(request,{
                     jobId: Date.now()
                }).then((job) => {
                let export_history = new Export_history({
                    type: TRIP_LIST.USER_HISTORY,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id:req.body.export_user_id,
                    data: job.data
                })
                export_history.save()
                res.json({ 
                    success: true,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: ""  
                });
            });
            return;
        }
        mExportDataController.openride_user_history_req_post(req, res);
    }catch(err){
        utils.error_response(err, req, res)
    }
}

//////////////////// user_history //////////////////////
exports.openride_user_history_req_post = async function (req, res) {
    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }], function (response) {
        if (response.success) {
            if(!req.body){
                req.body = req;
            }
            User.findOne({ _id: req.body.user_id }).then((user) => {
                if (user.token != req.body.token) {
                    return res.json({ 
                        success: false,
                        error_code: String(error_message.ERROR_CODE_INVALID_TOKEN),
                        error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_INVALID_TOKEN),
                    });
                } else {
                    let condition
                    let condition1
                    let unwind
                    let mongoose = require('mongoose');
                    let Schema = mongoose.Types.ObjectId;
                        unwind ={
                            $unwind: "$user_details",
                        }
                        condition = {$match: {"user_details.user_id": {$eq : Schema(req.body.user_id)}} };
                        condition1 = {
                             
                            $match: { 
                                $or: [
                                    {"is_trip_completed":{$eq: 1}},
                                    {$and: [{
                                        $or:[
                                            {"is_trip_cancelled":{$eq: 1}},
                                            {"is_trip_cancelled_by_provider":{$eq: 1}}
                                        ]},
                                        {
                                        $or:[
                                            {"user_details.booking_cancelled":{$eq: 1}},
                                            {"user_details.booking_cancelled_by_user":{$eq: 1}},
                                            {"user_details.booking_cancelled_by_provider":{$eq: 1}}
                                        ]}
                                    ]}
                                ]
                            }
                        };


                    let lookup1 = {
                        $lookup:
                        {
                            from: "providers",
                            localField: 'provider_id',
                            foreignField: "_id",
                            as: "provider_detail"
                        }
                    };
                    let unwind1 = {
                        $unwind: {
                            path: "$provider_detail",
                            preserveNullAndEmptyArrays: true
                        }
                    };

                    let lookup2 = {
                        $lookup:
                        {
                            from: "trip_services",
                            localField: "trip_service_city_type_id",
                            foreignField: "_id",
                            as: "service_type"
                        }
                    };
                    let unwind2 = { $unwind: "$service_type" };
                    let group = {
                        $project: {
                            trip_id: '$_id', unique_id: 1, invoice_number: 1,
                            current_provider: 1, provider_service_fees: 1,
                            is_trip_cancelled_by_user: 1,
                            is_trip_completed: 1,
                            is_trip_cancelled: 1,
                            is_user_rated: 1,
                            is_provider_rated: 1,
                            is_trip_cancelled_by_provider: 1,
                            first_name: '$provider_detail.first_name',
                            last_name: '$provider_detail.last_name',
                            picture: '$provider_detail.picture',
                            total: 1,
                            unit: 1,
                            currency: 1,
                            currencycode: 1,
                            total_time: 1,
                            user_create_time: 1,
                            total_distance: 1,
                            source_address: 1,
                            destination_address: 1,
                            destination_addresses: 1,
                            provider_trip_end_time: 1,
                            timezone: 1,
                            created_at: 1,
                            cash_payment: 1,
                            card_payment: 1,
                            wallet_payment: 1,
                            service_type: 1,
                            payment_mode: 1,
                            user_details:1
                        }
                    };


                    let search_item;
                    let search_value;
                    let sort_order;
                    let sort_field;
                    let value
                    let search
                    if (req.body.search_item == undefined) {
                        search_item = 'unique_id';
                        search_value = '';
                        sort_order = -1;
                        sort_field = 'provider_trip_end_time';
                    } else {
                        value = req.body.search_value;
                        value = value.trim();
                        value = value.replace(/ +(?= )/g, '');
                        value = new RegExp(value, 'i');
                        sort_order = req.body.sort_item[1];
                        sort_field = req.body.sort_item[0];
                        search_item = req.body.search_item
                        search_value = req.body.search_value;
                    }

                    value = search_value;
                    value = value.trim();
                    value = value.replace(/ +(?= )/g, '');
                    let query1 = {};
                    let query2 = {};
                    let query3 = {};
                    let query4 = {};
                    let query5 = {};
                    let query6 = {};
                    if (search_item == "unique_id") {

                        query1 = {};
                        if (value != "") {
                            value = Number(value)
                            query1[search_item] = { $eq: value };
                            search = { "$match": query1 };
                        }
                        else {
                            search = { $match: {} };
                        }
                    } else if (search_item == "first_name") {
                        query1 = {};
                        query2 = {};
                        query3 = {};
                        query4 = {};
                        query5 = {};
                        query6 = {};

                        let full_name = value.split(' ');
                        if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {
                            query1['first_name'] = { $regex: new RegExp(full_name[0], 'i') };
                            query2['last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                            search = { "$match": { $or: [query1, query2] } };
                        } else {
                            query1[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                            query2['last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                            query3[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                            query4['last_name'] = { $regex: new RegExp(full_name[0], 'i') };
                            query5[search_item] = { $regex: new RegExp(full_name[1], 'i') };
                            query6['last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                            search = { "$match": { $or: [query1, query2, query3, query4, query5, query6] } };
                        }
                    } else {
                        search = { "$match": { search_item: { $regex: new RegExp(value, 'i') } } };
                    }


                    let start_date = req.body.start_date;
                    let end_date = req.body.end_date;
                    if (end_date == '' || end_date == undefined) {
                        end_date = new Date();
                    } else {
                        end_date = new Date(end_date);
                        end_date = end_date.setHours(23, 59, 59, 999);
                        end_date = new Date(end_date);
                    }

                    if (start_date == '' || start_date == undefined) {
                        start_date = new Date(0);
                        start_date = start_date.setHours(0, 0, 0, 0);
                        start_date = new Date(start_date);
                    } else {
                        start_date = new Date(start_date);
                        start_date = start_date.setHours(0, 0, 0, 0);
                        start_date = new Date(start_date);
                    }
                    query1['created_at'] = { $gte: start_date, $lt: end_date };
                    let filter = { "$match": query1 };

                    let number_of_rec = 10;
                    let skip = {};
                    let page = req.body.page
                    skip["$skip"] = (page - 1) * number_of_rec;

                    let limit = {};
                    limit["$limit"] = number_of_rec;

                    let sort = { "$sort": {} };
                    sort["$sort"][sort_field] = parseInt(sort_order);

                    OpenRide.aggregate([unwind, condition, condition1, lookup1, unwind1, lookup2, unwind2, group, filter, search]).then((array) => {
                        let total_page = Math.ceil(array.length / 10)
                        
                            if (req.body.is_export) {
                                generate_open_ride_user_history_export_excel(req, res)
                                return
                            }
                        
                        if(req.body.page){
                            // condition, unwind, condition1,
                            OpenRide.aggregate([unwind, condition, condition1, lookup1, unwind1, lookup2, unwind2, group, filter, search, sort, skip, limit]).then((array_list) => {
                                if (res.json) {
                                    res.json({ 
                                        success: true, trips: array_list, pages: total_page, success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                                        success_message: "",  
                                    });
                                }
                                else{
                                    res({ 
                                        success: true, trips: array_list, pages: total_page, success_code: String(success_messages.DEFUALT_SUCCESS_CODE), success_message: "",  
                                    });
                                }
                            });
                        }else{
                            OpenRide.aggregate([unwind, condition, condition1, lookup1, unwind1, lookup2, unwind2, group, filter, search, sort]).then((array_list) => {
                                res.json({ 
                                    success: true, trips: array_list, pages: total_page, success_code: String(success_messages.DEFUALT_SUCCESS_CODE), success_message: "",  
                                });
                            });
                        }
                    }, (err) => {
                        res.json({ 
                            success: false,
                            error_code: String(error_message.ERROR_CODE_SOMETHING_WENT_WRONG),
                            error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_SOMETHING_WENT_WRONG),
                        });
                    });
                }
            }, (err) => {
                res.json({ 
                    success: false,
                    error_code: String(error_message.ERROR_CODE_SOMETHING_WENT_WRONG),
                    error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_SOMETHING_WENT_WRONG),
                });
            });
        } else {
            res.json({ 
                success: false,
                error_code: String(response.error_code),
                error_message: response.error_message,
            });
        }
    });
}

async function generate_open_ride_user_history_export_excel(req, res) {
    if(!req.body){
        req.body = req;
    }
    const setting_detail = await Settings.findOne({});
    const currentDate = moment().tz(setting_detail.timezone_for_display_date).format('HHmm_DDMMYYYY');
        let search_item = 'unique_id';
        let search_value = '';
        let sort_order = -1;
        let sort_field = 'unique_id';
        let value
        let start_date
        let end_date
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
                localField: "user_details.user_id",
                foreignField: "_id",
                as: "user_detail"
            }
        };
        let unwind = { $unwind: "$user_detail" };

        let lookup1 = {
            $lookup:
            {
                from: "providers",
                localField: "provider_id",
                foreignField: "_id",
                as: "provider_detail"
            }
        };

        value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');
        let search
        if (search_item == "unique_id") {

            let query1 = {};
            if (value != "") {
                value = Number(value)
                query1[search_item] = { $eq: value };
                search = { "$match": query1 };
            } else {
                search = { $match: {} };
            }

        } else if (search_item == "provider_detail.first_name") {
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
            search = { "$match": { search_item: { $regex: new RegExp(value, 'i') } } };
        }


        query1['created_at'] = { $gte: start_date, $lt: end_date };
        let filter = { "$match": query1 };

        let sort = { "$sort": {} };
        sort["$sort"][sort_field] = parseInt(sort_order);

        let mongoose = require('mongoose');
        let Schema = mongoose.Types.ObjectId;
        let user_details_unwind = { $unwind: "$user_details" };
        let condition = { 
            $match: { 'user_details.user_id': { $eq: Schema(req.body.user_id) }} 
        };
        let match = {
         $match: { 
            $or: [
                {"user_details.booking_cancelled":{$eq: 1}},
                {"user_details.booking_cancelled_by_user":{$eq: 1}},
                {"user_details.booking_cancelled_by_provider":{$eq: 1}}
            ]
         }}
        OpenRide.aggregate([user_details_unwind, match, condition, lookup, unwind, lookup1, search, filter, sort]).then((array) => {

            let wb = new xl.Workbook();
            let ws = wb.addWorksheet('sheet1');
            let col = 1;

            let title
            if(req.body.header){
                title = req.body.header
            }else{
                title = {
                    id : 'Trip ID',
                    user_id : 'UserId',
                    user : 'User',
                    driver_id : 'DriverId',
                    driver : 'Driver',
                    date : 'Date',
                    status : 'Status',
                    amount : 'Price',
                    payment : 'Payment',
                    payment_status : 'Payment Status',
                    title_status_cancel_by_provider : 'Cancelled By Provider',
                    title_status_cancel_by_user : 'Cancelled By User',
                    title_total_cancelled : 'Cancelled',
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
                        ws.cell(index + 2, col++).string(title.title_total_cancelled);
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
                    wb.write('data/xlsheet/user_history_' + currentDate + '.xlsx', async function (err) {
                        if (err) {
                            console.error(err);
                        } else {
                            let setting_detail = await Setting.findOne({},{history_base_url: 1})
                            let url = setting_detail.history_base_url +  "/xlsheet/user_history_"+currentDate + '.xlsx';

                            if(res.json){
                                res.json(url);
                            }else{
                                res(url);
                            }
                        }
                    });
                }
            });
        }, (err) => {
            utils.error_response(err, req, res)
        });
}



exports.openrideproviderhistory = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        if (req.body.is_export) {
            req.body.host = req.get('host')
            req.body.protocol = req.protocol
            let request = {
                body: req.body,
                headers: {
                    is_show_email: req.headers.is_show_email,
                    is_show_phone: req.headers.is_show_phone,
                }
            }
            queue_manager.earningExportQueueOfOpenRideProviderHistory.add(request,{
                     jobId: Date.now()
                }).then((job) => {
                let export_history = new Export_history({
                    type: TRIP_LIST.PROVIDER_HISTORY,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id:req.body.export_user_id,
                    data: job.data
                })
                export_history.save();
                res.json({ 
                    success: true,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: ""  
                });
            });
            return;
        }
        mExportDataController.openride_provider_history_req_body(req, res);
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

/////////////////////// provider_history ///////////////////////////////////
exports.openride_provider_history_req_body = async function (req, res) {
    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }], async function (response) {
        if (!req.body) {
            req.body = req
        }
        if (!response.success) {
            return res.json({ 
                success: false,
                error_code: String(response.error_code),
                error_message: response.error_message,
            });
        }

        let provider = await Provider.findById(req.body.provider_id)
        if (!provider) {
            return res.json({ 
                success: false,
                error_code: String(error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND),
                error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND),
            });
        }

        if (provider.token != req.body.token) {
            return res.json({ 
                success: false,
                error_code: String(error_message.ERROR_CODE_INVALID_TOKEN),
                error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_INVALID_TOKEN),
            });
        }
        let vehicles_lookup = {
            $lookup:
            {
                from: "vehicles",
                localField: "provider_vehicle_id",
                foreignField: "_id",
                as: "provider_vehicles_detail"
            }
        };
        let vehicles_unwind = {$unwind: "$provider_vehicles_detail"};
        let mongoose = require('mongoose');
        let Schema = mongoose.Types.ObjectId;

        let condition = { 
            $match:{
                $and: [
                        { 'confirmed_provider': { $eq: Schema(req.body.provider_id) } },
                        { 
                            $or: [
                                {"is_trip_completed":{$eq: 1}},
                                {"is_trip_cancelled":{$eq: 1}},
                                {"is_trip_cancelled_by_provider":{$eq: 1}}
                            ]
                        }
                ]
            }
        }

        // pangination and filter
        let search_item;
        let search_value;
        let sort_order;
        let sort_field;
        let value
        if (req.body.search_item == undefined) {
            search_item = 'unique_id';
            search_value = '';
            sort_order = -1;
            sort_field = 'unique_id';
        } else {
            value = req.body.search_value;
            value = value.trim();
            value = value.replace(/ +(?= )/g, '');
            value = new RegExp(value, 'i');
            sort_order = req.body.sort_item[1];
            sort_field = req.body.sort_item[0];
            search_item = req.body.search_item
            search_value = req.body.search_value;
        }

        value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');
        let query1 = {};
        let query2 = {};
        let query3 = {};
        let query4 = {};
        let query5 = {};
        let query6 = {};
        let search 
        if (search_item == "unique_id") {

            query1 = {};
            if (value != "") {
                value = Number(value)
                query1[search_item] = { $eq: value };
                search = { "$match": query1 };
            }
            else {
                search = { $match: {} };
            }
        } else if (search_item == "first_name") {
            query1 = {};
            query2 = {};
            query3 = {};
            query4 = {};
            query5 = {};
            query6 = {};

            let full_name = value.split(' ');
            if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {
                query1[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                query2['last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                search = { "$match": { $or: [query1, query2] } };
            } else {
                query1[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                query2['last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                query3[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                query4['last_name'] = { $regex: new RegExp(full_name[0], 'i') };
                query5[search_item] = { $regex: new RegExp(full_name[1], 'i') };
                query6['last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                search = { "$match": { $or: [query1, query2, query3, query4, query5, query6] } };
            }
        } else {
            search = { "$match": { search_item: { $regex: new RegExp(value, 'i') } } };
        }

        let start_date = req.body.start_date;
        let end_date = req.body.end_date;
        if (end_date == '' || end_date == undefined) {
            end_date = new Date();
        } else {
            end_date = new Date(end_date);
            end_date = end_date.setHours(23, 59, 59, 999);
            end_date = new Date(end_date);
        }

        if (start_date == '' || start_date == undefined) {
            start_date = new Date(0);
            start_date = start_date.setHours(0, 0, 0, 0);
            start_date = new Date(start_date);
        } else {
            start_date = new Date(start_date);
            start_date = start_date.setHours(0, 0, 0, 0);
            start_date = new Date(start_date);
        }

        query1['created_at'] = { $gte: start_date, $lt: end_date };
        let filter = { "$match": query1 };

        let number_of_rec = 10;
        let page = req.body.page || 1;
        let skip = {};
        skip["$skip"] = (page - 1) * number_of_rec;

        let limit = {};
        limit["$limit"] = number_of_rec;
        let sort = { "$sort": {} };
        sort["$sort"][sort_field] = parseInt(sort_order);
        /* Count Total Trips */
        

        let trips_total = await OpenRide.aggregate([ condition,vehicles_lookup, vehicles_unwind,  filter, search, sort]);
        let total_pages = Math.ceil(trips_total.length / number_of_rec)

        let trips = await OpenRide.aggregate([ condition, vehicles_lookup, vehicles_unwind, filter, search, sort, skip, limit]);
        if (req.body.is_export) {
            openride_provider_history_export_excel(req, res)
        }else{

            res.json({ 
                success: true, provider_open_rides: trips, page: total_pages,
                success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                success_message: "",  
            });
        }
        
    })
};

function openride_provider_history_export_excel(req, res) { 
    if(req.body.search_item == 'first_name'){
        req.body.search_item = 'user_detail.first_name'
    }
    if (typeof req.body.provider_id == 'undefined') {
        res.redirect('/provider_login');
    } else {
        const currentDate = moment().tz(setting_detail.timezone_for_display_date).format('HHmm_DDMMYYYY');
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

        let user_details_unwind = { $unwind: "$user_details" };

        let lookup = {
            $lookup:
            {
                from: "users",
                localField: "user_detail.user_id",
                foreignField: "_id",
                as: "user_detail"
            }
        };

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
    
    OpenRide.aggregate([condition,user_details_unwind, lookup,  lookup1, filter, search, sort]).then((array) => { 
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
                title_total_cancelled : 'Cancelled',
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
            ws.cell(index + 2, col++).number(data.user_details.unique_id);
            ws.cell(index + 2, col++).string(data.user_details.first_name + ' ' + data.user_details.last_name);

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
                    ws.cell(index + 2, col++).string(title.title_total_cancelled);
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
                wb.write('data/xlsheet/provider_history_'+currentDate + '.xlsx', async function (err) {
                    if (err) {
                        console.error(err);
                    } else {
                        let setting_detail = await Setting.findOne({},{history_base_url: 1})
                        let url = setting_detail.history_base_url +  "/xlsheet/provider_history_"+currentDate + '.xlsx';

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

exports.openride_get_trip_report = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        if (req.query.is_excel_sheet) {
            req.query.host = req.get('host')
            req.query.protocol = req.protocol

            let request = {
                is_open_ride: true,
                query: req.query,
                headers: {
                    is_show_email: req.headers.is_show_email,
                    is_show_phone: req.headers.is_show_phone,
                }
            }

            queue_manager.completeTripReportQueue.add(request, {
                jobId: Date.now()
            }).then((job) => {
                let export_history = new Export_history({
                    type: req.query.type,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id: req.query.export_user_id,
                    data: job.data
                })
                export_history.save()
                res.json({ 
                    success: true,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: ""
                });
            })
            return
        }
        mExportDataController.get_open_ride_report(req, res)
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_open_ride_report = async function (req, res) {
    if (!req.query) {
        req.query = req
    }

    const user_selected_country_id = req.query.country_id
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 1
    const type = req.query?.type

    const optional_filters = []
    let start_date;
    let end_date
    if (req.query.start_date == '' || req.query.start_date == undefined) {
        let date = new Date()
        start_date = new Date(null)
        end_date = date.setHours(23, 59, 59, 999)
        end_date = new Date(end_date)
        optional_filters.push({ 'created_at': { $gte: start_date, $lt: end_date } })
    } else {
        const startDate = moment(req.query.start_date).startOf('day').toDate();
        const endDate = moment(req.query.end_date).endOf('day').toDate();
        optional_filters.push({ 'complete_date_in_city_timezone': { $gte: startDate, $lt: endDate } })
    }

    if (req.query.trip_status) {
        const trip_status_value = Number(req.query.trip_status)
        let condition;
        if (trip_status_value == 2) {
            condition = { $or: [{ "is_trip_completed": 1 }, { "is_trip_cancelled": 1 }] };
        } else if (trip_status_value == 1) {
            condition = { "is_trip_completed": 1 };
        } else {
            condition = { "is_trip_cancelled": 1 };
        }
        optional_filters.push(condition)
    }
    
    if (req.query.user_name) {
        let search_value = req.query.user_name
        let condition = {};
        
        condition['user_details'] = {
            $elemMatch: {
                $or: [
                    { 'first_name': { $regex: search_value, $options: 'i' } },
                    { 'last_name': { $regex: search_value, $options: 'i' } }
                ]
            }
        }
        
        let value = (req.query.user_name).split(' ')
        if (value.length > 1) {
            let orConditions = [
                {
                    'user_details.first_name': { $regex: value[0], $options: 'i' },
                    'user_details.last_name': { $regex: value[1], $options: 'i' }
                },
                {
                    'user_details.first_name': { $regex: value[1], $options: 'i' },
                    'user_details.last_name': { $regex: value[0], $options: 'i' }
                }
            ];
    
            condition = { $or: orConditions }
        }
        optional_filters.push(condition)
    }


    if (req.query.city_id) {
        optional_filters.push({ "city_id": Schema(req.query.city_id) })
    }

    if (req.query.driver_id) {
        optional_filters.push({ "confirmed_provider": Schema(req.query.driver_id) })
    }

    if (req.query.provider_type_id) {
        optional_filters.push({ "provider_type_id": Schema(req.query.provider_type_id) })
    }

    if (req.query.service_type_id) {
        optional_filters.push({ "type_id": Schema(req.query.service_type_id) })
    }

    const and_condition = { $and: optional_filters }

    const aggregationPipeline = [
        {
            $match: {
                "country_id": Schema(user_selected_country_id),
                ...and_condition,
            },
        },
        {
            $lookup: {
                from: "types",
                localField: "type_id",
                foreignField: "_id",
                as: "type_detail"
            }
        },
        {
            $unwind: {
                path: "$type_detail",
                preserveNullAndEmptyArrays: true
            }
        },
    ]

    let Project = {
      $project: {
        unique_id: 1,
        provider_details: 1,
        vehicle_name: "$type_detail.typename",
        base_distance_cost: 1,
        total_distance: 1,
        unit: 1,
        distance_cost: 1,
        total_time: 1,
        time_cost: 1,
        currency: 1,
        total: 1,
        user_tax_fee: 1,
        tax_fee: 1,
        user_miscellaneous_fee: 1,
        tip_amount: 1,
        toll_amount: 1,
        provider_profit_fees: 1,
        provider_tax_fee: 1,
        provider_miscellaneous_fee: 1,
        payment_status: 1,
        user_create_time: 1,
        provider_trip_start_time: 1,
        provider_trip_end_time: 1,
        source_address: 1,
        destination_address: 1
      },
    }

    let sort = {}
    let sort_item = req.query.sort_item
    let sort_order = Number(req.query.sort_order)
    if (sort_item && sort_order) {
        sort = {
            $sort: {
                [sort_item]: sort_order
            }
        }
    } else {
        sort = { $sort: { unique_id: -1 } }
    }


    // Country and city based restriction condition
    let country_city_condition = await utils.get_country_city_condition(COLLECTION.TRIP, req.headers)
    aggregationPipeline.push({ $match: country_city_condition }, Project)

    if (!req.query.is_excel_sheet) {
        aggregationPipeline.push({
            $facet: {
                data: [{ $count: "tripCount" }],
                trips: [
                    sort,
                    { $skip: (page - 1) * limit },
                    { $limit: limit }
                ],
            },
        })
    }

    const result = await OpenRide.aggregate(aggregationPipeline)    
    
    if (req.query.is_excel_sheet) {
        generate_excel_for_open_ride_complete_trip_report(req, res, result, type, req.query.header)
        return
    }
    
    const trip_list = result[0].trips
    const total_page = Math.ceil((result[0]?.data[0]?.tripCount || 0) / limit)

    if (res.json) {
        res.json({ 
            success: true, trip_list: trip_list, total_page: total_page,
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message: "",  
        });
    } else {
        res({ 
            success: true, trip_list: trip_list, total_page: total_page,
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message: "",  
        });
    }
}

exports.openride_get_trip_list = async function (req, res) {
    try {
        let params_array = [{ name: "type", type: 'string' }]
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        if (req.query.is_excel_sheet) {
            req.query.host = req.get('host')
            req.query.protocol = req.protocol

            let request = {
                query: req.query,
                headers: {
                    is_show_email: req.headers.is_show_email,
                    is_show_phone: req.headers.is_show_phone,
                }
            }
            
            queue_manager.tripExportQueueForOpenRide.add(request,{
                     jobId: Date.now()
                }).then((job) => {
                let export_history = new Export_history({
                    type: req.query.type,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id:req.query.export_user_id,
                    data: job.data
                })
                export_history.save();
                res.json({ 
                    success: true,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: "" 
                });
            });
            return;
        }
        mExportDataController.openride_get_trip_list_res(req, res);
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.openride_get_trip_list_res = async function (req, res){
    if(!req.query){
        req.query = req;
    }

    let type = req.query.type
    let limit = Number(req.query.limit)
    let page = Number(req.query.page) - 1

    let search_by = req.query.search_by
    let search_value = req.query.search_value
    
    // pagination query 
    let condition = {}
    let user_type_condition = { $match: {} };
    let status_condition = { $match: {} };
    let booking_type_condition = { $match: {} };
    let start_date = req.query.start_date;
    let end_date = req.query.end_date;
    let payment_mode = Number(req.query.payment_mode)
    let payment_condition = { $match: { payment_mode: { $eq: payment_mode } } }
    let date_filter_value = "created_at";
    if(req.query.booking_type && req.query.booking_type != 0){
        booking_type_condition['$match']['booking_type'] = { $eq: +req.query.booking_type }
    }
    if (type == TRIP_LIST.OPEN_RIDE_RUNNING_TRIP || type == TRIP_LIST.RUNNING_TRIP_OF_PARTNER) {
        status_condition['$match']['is_schedule_trip'] = { $eq: false }
        
        status_condition = {
            $match: {
              $or: [
                {
                  "user_details": {
                    $elemMatch: {
                      "payment_status": 1,
                      "booking_cancelled": 1
                    }
                  }
                },
                {
                    "user_details": {
                        $elemMatch: {
                            "payment_status": 0,
                            "booking_cancelled": 0
                        }
                    }
                }
              ]
            }
          };
          

        status_condition['$match']['is_trip_cancelled'] = { $eq: 0 }
        status_condition['$match']['is_trip_completed'] = { $eq :0 }
        status_condition['$match']['$and'] = [{ is_provider_status: { $gte: 4, $lt: 9 }}]  

    }
    else if (type == TRIP_LIST.OPEN_RIDE_SCHEDULED_TRIP) {
        status_condition['$match']['is_trip_cancelled'] = { $eq: 0 }
        status_condition['$match']['is_trip_completed'] = { $eq: 0 }
        status_condition['$match']['is_trip_cancelled_by_provider'] = { $eq: 0 }
        status_condition['$match']['is_schedule_trip'] = { $eq: false }
        status_condition['$match']['is_provider_status'] = { $eq: 0 }
    }
    else if (type == TRIP_LIST.OPEN_RIDE_COMPLETED_TRIP) {
        if (req.query.user_type_id || req.query.provider_type_id) {
            let query1 = {}
            let query2 = {}
            if (req.query.user_type_id && req.query.user_type != '1') {
                user_type_condition['$match']['user_type_id'] = { $eq: Schema(req.query.user_type_id) }
            }
            if (req.query.user_type_id && req.query.user_type == '1') {
                user_type_condition['$match']['user_id'] = { $eq: Schema(req.query.user_type_id) }
            }
            query1['is_trip_completed'] = { $eq: 1 }
            query2['is_trip_cancelled'] = { $eq: 0 }
            status_condition = { "$match": { $or: [query1, query2] } }
        } else {
            status_condition = { $match: { $and: [{ is_trip_completed: 1 }, { is_trip_cancelled: 0 }] } }
            status_condition['$match']['is_provider_status'] = { $eq: 9 }
        }
    }
    else if(type == 0  || type == TRIP_LIST.COMPLETED_TRIP_OF_PARTNER){
        if (req.query.user_type_id || req.query.provider_type_id) {
            let query1 = {}
            let query2 = {}
            if (req.query.user_type_id && req.query.user_type != '1') {
                user_type_condition['$match']['user_type_id'] = { $eq: Schema(req.query.user_type_id) }
            }
            if (req.query.user_type_id && req.query.user_type == '1') {
                user_type_condition['$match']['user_id'] = { $eq: Schema(req.query.user_type_id) }
            }
            query1['is_trip_completed'] = { $eq: 1 }
            query2['is_trip_cancelled'] = { $eq: 1}
            status_condition = { "$match": { $or: [query1, query2] } }
        } else {
            status_condition = { $match: { $or: [{ is_trip_completed: 1 }, { is_trip_cancelled: 0 }] } }
        }
    } else {
        status_condition = { $match: { $or: [{ is_trip_cancelled: 1 }, { is_trip_cancelled_by_provider: 1 }] } }
    }

    if (req.query.provider_type_id) {
        user_type_condition['$match']['provider_type_id'] = { $eq: Schema(req.query.provider_type_id) }
    }
    if (req.query.provider_id) {
        user_type_condition['$match']['provider_id'] = { $eq: Schema(req.query.provider_id) }
    }

    let date_filter = { "$match": {} }
    if (type == TRIP_LIST.OPEN_RIDE_SCHEDULED_TRIP) {
        date_filter_value = "server_start_time_for_schedule";
    }
    if (type == TRIP_LIST.OPEN_RIDE_COMPLETED_TRIP) {
        date_filter_value = "complete_date_in_city_timezone";
    }
    if (type == TRIP_LIST.OPEN_RIDE_CANCELLED_TRIP) {
        date_filter_value = "complete_date_in_city_timezone";
    }
    if (req.query.start_date == '' || req.query.start_date == undefined) {
        let date = new Date()
        start_date = new Date(null);
        end_date = date.setHours(23, 59, 59, 999);
        end_date = new Date(end_date);

        date_filter["$match"][date_filter_value] = { $gte: start_date, $lt: end_date }
    } else {
        const startDate = moment(req.query.start_date).startOf('day').toDate();
        const endDate = moment(req.query.end_date).endOf('day').toDate();
        date_filter["$match"][date_filter_value] = { $gte: startDate, $lt: endDate }
    }
    if (payment_mode == undefined || payment_mode == 2) {
        payment_condition = { $match: {} }
    }
    let service_type_lookup = {
        $lookup:
            {
                from: "types",
                localField: "type_id",
                foreignField: "_id",
                as: "service_type_detail"
            }
    }
    let service_type_unwind = {$unwind: "$service_type_detail"};

    // project optimize query
    let Project = {
        $project: {
            provider_id: 1,
            unique_id: 1,
            total: 1,
            is_provider_status: 1,
            payment_mode: 1,
            is_trip_completed: 1,
            complete_date_in_city_timezone: 1,
            user_create_time: 1,
            is_trip_cancelled: 1,
            is_trip_cancelled_by_user: 1,
            is_trip_cancelled_by_provider: 1,
            is_provider_accepted: 1,
            payment_status: 1,
            server_start_time_for_schedule: 1,
            provider_trip_end_time: 1,
            fixed_price: 1,
            currency: 1,
            provider_details: 1,
            user_details:1,
            "vehicle_details._id": "$type_id",
            "vehicle_details.typename": { $ifNull: ["$service_type_detail.typename", "***"] }
        }
    }

    if (search_by && search_value) {
        if (search_by == 'unique_id' || search_by == 'payment_mode') {
            search_value = Number(req.query.search_value)
            condition[search_by] = search_value
        } else {
            condition[search_by] = { $regex: search_value, $options: 'i' }
            let value = search_value.split(' ')
            let name = !search_by.includes("typename")
            if (value.length > 1 && name) {
                condition[search_by] = { $regex: value[0], $options: 'i' }
                let diff_search = search_by.split('.')
                condition[diff_search[0] + '.last_name'] = { $regex: value[1], $options: 'i' }
            }
        }
    }
    // sorting
    let sort = {}
    let sort_item = req.query.sort_item
    let sort_order = Number(req.query.sort_order)
    if (sort_item && sort_order) {
        sort = {
            $sort: {
                [sort_item]: sort_order
            }
        }
    } else {
        sort = { $sort: { unique_id: -1 } }
    }
    if (req.query.is_excel_sheet) {
        page = null
        Project = {
            $project: {
                payment_status: 1,
                total: 1,
                payment_mode: 1,
                is_provider_status: 1,
                unique_id: 1,
                created_at: 1,
                refund_amount: 1,
                is_amount_refund: 1,
                server_start_time_for_schedule: 1,
                provider_id: 1,
                is_trip_completed: 1,
                complete_date_in_city_timezone: 1,
                user_create_time: 1,
                is_trip_cancelled: 1,
                is_trip_cancelled_by_user: 1,
                is_trip_cancelled_by_provider: 1,
                is_provider_accepted: 1,
                provider_trip_end_time: 1,
                fixed_price: 1,
                currency: 1,
                user_details:1,
                provider_details: 1,
                // "user_details._id": "$user_id",
                // "user_details.first_name": "$user_first_name",
                // "user_details.last_name": "$user_last_name",
                // "user_details.unique_id": { $ifNull: ["$user_unique_id", 0] },
                // "provider_details._id": "$current_provider",
                // "provider_details.first_name": "$provider_first_name",
                // "provider_details.last_name": "$provider_last_name",
                // "provider_details.unique_id": { $ifNull: ["$provider_unique_id", 0] },
                "vehicle_details._id": "$type_id",
                "vehicle_details.typename": { $ifNull: ["$typename", "***"] },
            }
        }
    }
    // total count login
    let count;
    let pagination
    if (page !== null) {
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
    let unwind =  { $match : {} }
    if (req.query.is_excel_sheet) {
        unwind ={
            $unwind: "$user_details",
        }
    }
    
    let trip_list = await OpenRide.aggregate([ { $match: country_city_condition }, date_filter, status_condition, user_type_condition, booking_type_condition, payment_condition,service_type_lookup, service_type_unwind, unwind, Project , { $match: condition },sort, count, pagination])
    if (req.query.is_excel_sheet) {
        generate_excel_For_Openride(req, res, trip_list[0].data, type , req.query.header)
        return
    }
    if(res.json){
        res.json({ 
            success: true, trip_list: trip_list,
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message: "",  
        });
    }else{
        res({ 
            success: true, trip_list: trip_list,
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message: "",  
        });
    }
}

// excel sheet download
async function generate_excel_For_Openride(req, res, array, type , header) {
    let setting_detail = await Setting.findOne({},{history_base_url: 1,timezone_for_display_date:1})
    const currentDate = moment().tz(setting_detail.timezone_for_display_date).format('HHmm_DDMMYYYY');
    let wb = new xl.Workbook();
    let ws = wb.addWorksheet('sheet1');
    let col = 1;
    let typename;
    switch (type) {
        case '20':
            typename = 'Open_ride_Running_Trip';
            break;
        case '21':
            typename = 'Open_ride_Scheduled_Trip';
            break;
        case '22':
            typename = 'Open_ride_Completed_Trip';
            break;
        default:
            typename = 'Open_ride_Cancelled_Trip';
            break;
    }
    let title
            if(header){
                title = JSON.parse(header)
            }else{
                title = {
                    id : 'Trip ID',
                    user_id : 'UserId',
                    user : 'User',
                    driver_id : 'DriverId',
                    driver : 'Driver',
                    date : 'Date',
                    status : 'Status',
                    amount : 'Price',
                    payment : 'Payment',
                    payment_status : 'Payment Status',
                    title_status_cancel_by_provider : 'Cancelled By Provider',
                    title_status_cancel_by_user : 'Cancelled By User',
                    title_total_cancelled:'Cancelled',
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
        ws.cell(1, col++).string(title.date);
        ws.cell(1, col++).string(title.driver_id);
        ws.cell(1, col++).string(title.driver);
        ws.cell(1, col++).string(title.user_id);
        ws.cell(1, col++).string(title.user);
        ws.cell(1, col++).string(title.status);
        ws.cell(1, col++).string(title.amount);
        ws.cell(1, col++).string(title.payment);
        ws.cell(1, col++).string(title.payment_status);

        let pushed_request_arr = []

    array.forEach(function (data, index) {
        col = 1;
        let index_of_pushed_request
        if(data?.unique_id){
            index_of_pushed_request = pushed_request_arr.findIndex((values)=> values == data.unique_id)
            let value = ""
            if(index_of_pushed_request == -1){
                pushed_request_arr.push(data.unique_id)
                value = (data.unique_id).toString()
            }
            ws.cell(index + 2, col++).string(value);
        }else{
            col++
        }
        
        let date_value = ""
        if(index_of_pushed_request == -1){
            ws.cell(index + 2, col++).string(moment(data.created_at).tz(setting_detail.timezone_for_display_date).format('DD MMM YYYY HH:mm a'));
        }else{
            ws.cell(index + 2, col++).string(date_value);

        }

        if (data.provider_details) {
            let unique_id_value = ""
            let first_name_value = ""
            let last_name_value = ""
            if(index_of_pushed_request == -1){
                pushed_request_arr.push(data.unique_id)
                unique_id_value = (data.provider_details[0].unique_id).toString()
                first_name_value = (data.provider_details[0].first_name).toString()
                last_name_value = (data.provider_details[0].last_name).toString()
            }
            ws.cell(index + 2, col++).string(unique_id_value);
            ws.cell(index + 2, col++).string(first_name_value + ' ' + last_name_value);
        } else {
            col += 2;
        }




        

        if (data.user_details) {
            ws.cell(index + 2, col++).number(data.user_details.unique_id);
            ws.cell(index + 2, col++).string(data.user_details.first_name + ' ' + data.user_details.last_name);
        } else {
            col += 2
        }
       
        if (data.is_trip_cancelled == 1) {
            if (data.is_trip_cancelled_by_provider == 1) {
                ws.cell(index + 2, col++).string(title.title_status_cancel_by_provider);
            } else if (data.is_trip_cancelled_by_user == 1) {
                ws.cell(index + 2, col++).string(title.title_status_cancel_by_user);
            } else {
                ws.cell(index + 2, col++).string(title.title_total_cancelled);
            }
        } else {
            if (data.is_provider_status == 2) {
                ws.cell(index + 2, col++).string(title.title_trip_status_coming);
            } else if (data.is_provider_status == 4) {
                ws.cell(index + 2, col++).string(title.title_trip_status_arrived);
            } else if (data.is_provider_status == 6) {
                ws.cell(index + 2, col++).string(title.title_trip_status_trip_started);
            } else if (data.is_provider_status == 9) {
                ws.cell(index + 2, col++).string(title.title_trip_status_completed);
            } else if (data.is_provider_status == 1 || data.is_provider_status == 0) {
                if (data.is_provider_accepted == 1) {
                    ws.cell(index + 2, col++).string(title.title_trip_status_accepted);
                } else {
                    ws.cell(index + 2, col++).string(title.title_trip_status_waiting);
                }
            }
        }


        if (data.user_details) {
            ws.cell(index + 2, col++).number(data.user_details.total);
            if (data.user_details.payment_mode == 1) {
                ws.cell(index + 2, col++).string(title.title_pay_by_cash);
            } else {
                ws.cell(index + 2, col++).string(title.title_pay_by_card);
            }
        }

        if (data.user_details) {
            if (data.user_details.payment_status == 0) {
                ws.cell(index + 2, col++).string(title.title_pending);
            } else {
                if (data.user_details.payment_status == 1) {
                    ws.cell(index + 2, col++).string(title.title_paid);
                } else {
                    ws.cell(index + 2, col++).string(title.title_not_paid);
                }
            }
        }

        if (index == array.length - 1) {
            wb.write('data/xlsheet/' + typename + '_' + currentDate + '.xlsx', async function (err) {
                if (err) {
                    console.error(err);
                } else {
                    let url = setting_detail.history_base_url +"/xlsheet/" + typename + '_' + currentDate + '.xlsx';
                    if(res.json){
                        res.json(url);
                    }else{
                        res(url);
                    }
                }
            });
        }
    })
}

// rental trip apis start
exports.get_rental_trip_list = async function (req, res) {
    try {
        let params_array = [{ name: "type", type: 'string' }]
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        if (req.query.is_excel_sheet) {
            req.query.host = req.get('host')
            req.query.protocol = req.protocol

            let request = {
                query: req.query,
                headers: {
                    is_show_email: req.headers.is_show_email,
                    is_show_phone: req.headers.is_show_phone,
                }
            }
            
            queue_manager.tripExportRecordsQueueForRentalRide.add(request,{
                     jobId: Date.now()
                }).then((job) => {
                let export_history = new Export_history({
                    type: req.query.type,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id: req.query.export_user_id,
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
        mExportDataController.get_rental_trip_list_res(req, res);
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_rental_trip_list_res = async function (req, res){
    if(!req.query){
        req.query = req;
    }

    console.log(req.query);
    
    let type = req.query.type;
    let limit = Number(req.query.limit);
    let page = Number(req.query.page) - 1;

    let search_by = req.query.search_by;
    let search_value = req.query.search_value;
    
    let start_date = req.query.start_date;
    let end_date = req.query.end_date;
    
    // pagination query 
    let condition = {};
    let user_type_condition = { $match: {} };
    let status_condition = { $match: {} };
    let booking_type_condition = { $match: {} };
        
    if(type == TRIP_LIST.RENTAL_RUNNING_REQUEST){
        booking_type_condition["$match"]['status'] = { $in:[ RENTAL_TRIP_STATUS.CREATED, RENTAL_TRIP_STATUS.ACCEPTED ] };
        if(req.query.booking_type == 1 ){ // upcoming
            booking_type_condition['$match']['status'] = { $eq : RENTAL_TRIP_STATUS.PAYMENT }; 
        } else if (req.query.booking_type == 2 ) { // ongoing
            booking_type_condition['$match']['status'] = { $in:[ RENTAL_TRIP_STATUS.DRIVER_HANDOVER, RENTAL_TRIP_STATUS.USER_HANDOVER, RENTAL_TRIP_STATUS.ADDITIONAL_PAYMENT ] }
        }
    } 

    if (type == TRIP_LIST.RENTAL_RUNNING_REQUEST) {
        status_condition['$match']['is_trip_cancelled'] = { $eq: 0 }
        status_condition['$match']['$or'] = [{ is_trip_completed :0 }, {is_trip_completed:1, payment_status:{$ne:1}}]
    } else if (type == TRIP_LIST.RENTAL_COMPLETED_REQUEST) {
        status_condition['$match']['is_trip_completed'] = { $eq: 1 }
    } else {
        status_condition['$match']['is_trip_cancelled'] = { $eq: 1 }
    }

    if (req.query.provider_type_id) {
        user_type_condition['$match']['provider_type_id'] = { $eq: Schema(req.query.provider_type_id) }
    }
    if (req.query.provider_id) {
        user_type_condition['$match']['provider_id'] = { $eq: Schema(req.query.provider_id) }
    }

    let date_filter = { "$match": {} }
    let date_filter_value = "user_create_time";

    if (type == TRIP_LIST.RENTAL_COMPLETED_REQUEST || type == TRIP_LIST.RENTAL_CANCELLED_REQUEST) {
        date_filter_value = "complete_date_in_city_timezone";
    }

    if (req.query.start_date == '' || req.query.start_date == undefined) {
        let date = new Date()
        start_date = new Date(null);
        end_date = date.setHours(23, 59, 59, 999);
        end_date = new Date(end_date);

        date_filter["$match"][date_filter_value] = { $gte: start_date, $lt: end_date }
    } else {
        const startDate = moment(req.query.start_date).startOf('day').toDate();
        const endDate = moment(req.query.end_date).endOf('day').toDate();
        date_filter["$match"][date_filter_value] = { $gte: startDate, $lt: endDate }
    }

    let type_lookup = {
        $lookup:{
            from: "car_rent_types",
            localField: "type_id",
            foreignField: "_id",
            as: "vehicle_type_details"
        }
    }
    let type_unwind = {$unwind: "$vehicle_type_details"};

    // project optimize query
    let Project = {
        $project: {
            unique_id: 1,
            provider_id: 1,
            user_id: 1,
            vehicle_id: 1,
            total: 1,
            is_provider_status: 1,
            is_trip_completed: 1,
            payment_mode: 1,
            complete_date_in_city_timezone: 1,
            user_create_time: 1,
            schedule_start_time: 1,
            schedule_end_time: 1,
            is_trip_cancelled: 1,
            is_trip_cancelled_by_user: 1,
            is_trip_cancelled_by_provider: 1,
            is_provider_accepted: 1,
            payment_status: 1,
            server_start_time_for_schedule: 1,
            provider_trip_end_time: 1,
            currency: 1,
            status: 1,
            cancelled_by: 1,
            "user_details._id": "$user_id",
            "user_details.first_name": "$user_first_name",
            "user_details.last_name": "$user_last_name",
            "user_details.unique_id": "$user_unique_id",
            "user_details.user_phone": "$user_phone",
            "user_details.user_phone_code": "$user_phone_code",
            "provider_details._id": "$provider_id",
            "provider_details.first_name": "$provider_first_name",
            "provider_details.last_name": "$provider_last_name",
            "provider_details.unique_id": "$provider_unique_id",
            "provider_details.user_phone": "$provider_phone",
            "provider_details.user_phone_code": "$provider_phone_code",
            "vehicle_details.typename": { $ifNull: ["$vehicle_type_details.name", "--"] }
        }
    }

    if (search_by && search_value) {
        if (search_by == 'unique_id' || search_by == 'payment_mode') {
            search_value = Number(req.query.search_value)
            condition[search_by] = search_value
        } else if (search_by == 'user_details.first_name' || search_by == 'provider_details.first_name') {
            condition[search_by] = { $regex: search_value, $options: 'i' }
            let value = search_value.split(' ')
            let name = !search_by.includes("typename")
            if (value.length > 1 && name) {
                condition[search_by] = { $regex: value[0], $options: 'i' }
                let diff_search = search_by.split('.')
                condition[diff_search[0] + '.last_name'] = { $regex: value[1], $options: 'i' }
            }
        } else {
            condition["vehicle_details.typename"] = { $regex: search_value, $options: 'i' }
            let value = search_value.split(' ')
            let name = !search_by.includes("typename")
            if (value.length > 1 && name) {
                condition[search_by] = { $regex: value[0], $options: 'i' }
                let diff_search = search_by.split('.')
                condition[diff_search[0] + '.last_name'] = { $regex: value[1], $options: 'i' }
            }
        }
    }

    // sorting
    let sort = {}
    let sort_item = req.query.sort_item
    let sort_order = Number(req.query.sort_order)
    if (sort_item && sort_order) {
        sort = {
            $sort: {
                [sort_item]: sort_order
            }
        }
    } else {
        sort = { $sort: { unique_id: -1 } }
    }
    if (req.query.is_excel_sheet) {
        page = null
        Project = {
            $project: {
                unique_id: 1,
                provider_id: 1,
                user_id: 1,
                vehicle_id: 1,
                total: 1,
                is_provider_status: 1,
                is_trip_completed: 1,
                payment_mode: 1,
                complete_date_in_city_timezone: 1,
                user_create_time: 1,
                schedule_start_time: 1,
                schedule_end_time: 1,
                is_trip_cancelled: 1,
                is_trip_cancelled_by_user: 1,
                is_trip_cancelled_by_provider: 1,
                is_provider_accepted: 1,
                payment_status: 1,
                server_start_time_for_schedule: 1,
                provider_trip_end_time: 1,
                currency: 1,
                status: 1,
                cancelled_by: 1,
                "user_details._id": "$user_id",
                "user_details.first_name": "$user_first_name",
                "user_details.last_name": "$user_last_name",
                "user_details.unique_id": "$user_unique_id",
                "user_details.user_phone": "$user_phone",
                "user_details.user_phone_code": "$user_phone_code",
                "provider_details._id": "$provider_id",
                "provider_details.first_name": "$provider_first_name",
                "provider_details.last_name": "$provider_last_name",
                "provider_details.unique_id": "$provider_unique_id",
                "provider_details.user_phone": "$provider_phone",
                "provider_details.user_phone_code": "$provider_phone_code",
                // vehicle_details: 1,
                "vehicle_details.typename": { $ifNull: ["$vehicle_type_details.name", "--"] },
            }
        }
    }

    // total count login
    let count;
    let pagination;
    if (page !== null) {
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
    
    // apply query for particular type
    let trip_list = await Rental_Trip.aggregate([{ $match: country_city_condition }, date_filter, status_condition, user_type_condition, booking_type_condition, type_lookup, type_unwind, Project, { $match: condition }, sort, count, pagination])
    if (req.query.is_excel_sheet) {
        generate_excel_For_rental_ride(req, res, trip_list[0].data, type , req.query.header)
        return
    }
    if(res.json){
        res.json({ 
            success: true,trip_list: trip_list,
            success_message: "",
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
        });
    }else{
        res({ 
            success: true,trip_list: trip_list,
            success_message: "",
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
        });
    }
}

// excel sheet download
async function generate_excel_For_rental_ride(req, res, array, type , header) {
    let setting_detail = await Setting.findOne({},{history_base_url: 1,timezone_for_display_date:1})
    const currentDate = moment().tz(setting_detail.timezone_for_display_date).format('HHmm_DDMMYYYY');
    let wb = new xl.Workbook();
    let ws = wb.addWorksheet('sheet1');
    let col = 1;
    let typename;
    switch (type) {
        case '25':
            typename = 'Rental_Running_Ride';
            break;
        case '26':
            typename = 'Rental_Completed_Ride';
            break;
        default:
            typename = 'Rental_Cancelled_Ride';
            break;
    }
    let title
    if(header){
        title = JSON.parse(header)
    }else{
        title = {
            id : 'Trip ID',
            user_id : 'UserId',
            user : 'User',
            driver_id : 'DriverId',
            driver : 'Driver',
            date : 'Date',
            status : 'Status',
            amount : 'Price',
            payment : 'Payment',
            payment_status : 'Payment Status',
            title_status_cancel_by_provider : 'Cancelled By Provider',
            title_status_cancel_by_user : 'Cancelled By User',
            title_total_cancelled:'Cancelled',
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
    ws.cell(1, col++).string(title.amount);
    ws.cell(1, col++).string(title.status);
    ws.cell(1, col++).string(title.payment_status);
    ws.cell(1, col++).string(title.date);

    array.forEach(function (data, index) {
        col = 1;
        
        if(data?.unique_id){
            ws.cell(index + 2, col++).number(data.unique_id);
        }else{
            col++
        }
        
        if (data.user_details) {
            ws.cell(index + 2, col++).number(data.user_details.unique_id);
            ws.cell(index + 2, col++).string(data.user_details.first_name + ' ' + data.user_details.last_name);
        } else {
            col += 2
        }
            
        if (data.provider_details && data.provider_details.unique_id) {
            ws.cell(index + 2, col++).number(data.provider_details.unique_id);
            ws.cell(index + 2, col++).string(data.provider_details.first_name + ' ' + data.provider_details.last_name);
        } else {
            col += 2;
        }

        ws.cell(index + 2, col++).number(data.total);

        if (data.status == 0) {
            ws.cell(index + 2, col++).string(title.title_pending);
        } else if (data.status == 1 || data.status == 2) {
            ws.cell(index + 2, col++).string(title.title_trip_status_accepted);
        } else if (data.status == 3 || data.status == 4 || data.status == 5) {
            ws.cell(index + 2, col++).string(title.title_trip_status_trip_started);
        } else if (data.status == 6) {
            ws.cell(index + 2, col++).string(title.title_trip_status_completed);
        } else if (data.status == 7) {
            ws.cell(index + 2, col++).string(title.title_total_cancelled);
        }

        if (data.payment_status == 0 || data.payment_status == 2) {
            ws.cell(index + 2, col++).string(title.title_not_paid);
        } else {
            ws.cell(index + 2, col++).string(title.title_paid);
        }

        ws.cell(index + 2, col++).string(moment(data.user_create_time).tz(setting_detail.timezone_for_display_date).format('DD MMM YYYY HH:mm a'));

        if (index == array.length - 1) {
            wb.write('data/xlsheet/' + typename + '_' + currentDate + '.xlsx', async function (err) {
                if (err) {
                    console.error(err);
                } else {
                    let url = setting_detail.history_base_url +"/xlsheet/" + typename + '_' + currentDate + '.xlsx';
                    if(res.json){
                        res.json(url);
                    }else{
                        res(url);
                    }
                }
            });
        }
    })
}

// rental trip report
exports.get_rental_trip_report = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        if (req.query.is_excel_sheet) {
            req.query.host = req.get('host')
            req.query.protocol = req.protocol

            let request = {
                query: req.query,
                headers: {
                    is_show_email: req.headers.is_show_email,
                    is_show_phone: req.headers.is_show_phone,
                }
            }
            
            queue_manager.rentalTripReportQueue.add(request,
                {
                    jobId: Date.now()
                }
                ).then((job) => {
                let export_history = new Export_history({
                    type: req.query.type,
                    status: EXPORT_HISTORY_STATUS.QUEUED,
                    unique_id: job.id,
                    export_user_id:req.query.export_user_id,
                    data: job.data
                })
                export_history.save();
                res.json({ 
                    success: true,
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: ""
                });
            });
            return;
        }
        mExportDataController.get_rental_trip_report_data(req, res);
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_rental_trip_report_data = async function (req, res){

    if(!req.query){
        req.query = req;
    }

    const user_selected_country_id = req.query.country_id; 
    const page = Number(req.query.page) || 1; 
    const limit = Number(req.query.limit) || 1;
    const type = req.query?.type

    const optional_filters = [];
    let start_date;
    let end_date;
    if (req.query.start_date == '' || req.query.start_date == undefined) {
        let date = new Date()
        start_date = new Date(null);
        end_date = date.setHours(23, 59, 59, 999);
        end_date = new Date(end_date);
        optional_filters.push({ 'created_at': { $gte: start_date, $lt: end_date } })
    } else {
        const startDate = moment(req.query.start_date).startOf('day').toDate();
        const endDate = moment(req.query.end_date).endOf('day').toDate();
        optional_filters.push({ 'complete_date_in_city_timezone': { $gte: startDate, $lt: endDate } })
    }

    if (req.query.trip_status) {
        const trip_status_value = Number(req.query.trip_status);
        let condition;
        if (trip_status_value == 2) {
            condition = { $or: [{ "is_trip_completed": 1 }, { "is_trip_cancelled": 1 }] };
        } else if (trip_status_value == 1) {
            condition = { "is_trip_completed": 1 };
        } else {
            condition = { "is_trip_cancelled": 1 };
        }
        optional_filters.push(condition);
    }

    if(req.query.user_name){
        let search_value = req.query.user_name
        let condition = {
            $or: [
                {
                    'user_first_name': { $regex: search_value, $options: 'i' },
                },
                {
                    'user_last_name': { $regex: search_value, $options: 'i' },
                }
            ]
        }
        
        let value = (req.query.user_name).split(' ')
        if (value.length > 1) {
            condition = {}
            condition['user_first_name'] = { $regex: value[0], $options: 'i' }
            condition['user_last_name'] = { $regex: value[1], $options: 'i' }
        }
        optional_filters.push(condition)
    }
 
    if(req.query.driver_id){
        optional_filters.push({"provider_id": Schema(req.query.driver_id) });
    }

    const and_condition = { $and: optional_filters };

    const aggregationPipeline = [
        {
            $match: {
                "country_id": Schema(user_selected_country_id),
                ...and_condition,
            },  
        },
        {
            $lookup: {
                from: "car_rent_types",
                localField: "type_id",
                foreignField: "_id",
                as: "type_detail"
            }
        },
        {
            $unwind: {
                path: "$type_detail",
                preserveNullAndEmptyArrays: true
              }
        },
    ];

    let Project = {
        $project: { unique_id: 1, user_first_name:1, user_last_name:1, provider_first_name:1, provider_last_name:1, vehicle_name: '$type_detail.name', base_price:1, total: 1, provider_service_fees:1, platform_fee:1, payment_status: 1, is_trip_completed: 1, is_trip_cancelled: 1, cancelled_by: 1, user_create_time: 1, is_provider_accepted: 1, currency:1, schedule_start_time:1, schedule_end_time:1, address:'$vehicle_price_details.address', status:1 }
    }

    let sort = {}
    let sort_item = req.query.sort_item
    let sort_order = Number(req.query.sort_order)
    if (sort_item && sort_order) {
        sort = {
            $sort: {
                [sort_item]: sort_order
            }
        }

        if(sort_item == "provider_trip_start_time"){
            sort = {
                $sort: {
                    ["schedule_start_time"]: sort_order
                }
            }
        }

        if(sort_item == "provider_trip_end_time"){
            sort = {
                $sort: {
                    ["schedule_end_time"]: sort_order
                }
            }
        }

    } else {
        sort = { $sort: { unique_id: -1 } }
    }
   

    // Country and city based restriction condition
    let country_city_condition = await utils.get_country_city_condition(COLLECTION.TRIP, req.headers)
    aggregationPipeline.push({$match: country_city_condition},Project)

    let count = [{ $group: { _id: null, total: { $sum: 1 } } }];
    let total_trip_list = await Rental_Trip.aggregate([...aggregationPipeline,...count]);
    let total_page = Math.ceil((total_trip_list[0]?.total || 0) / limit)

    if (req.query.is_excel_sheet) {
        let total_trip_list = await Rental_Trip.aggregate(aggregationPipeline);
        generate_excel_for_rental_trip_report(req, res, total_trip_list, type, req.query.header);
        return
    }

    aggregationPipeline.push(
        sort,
        { $skip: (page - 1) * limit },
        { $limit: limit },
    );

    let trip_list = await Rental_Trip.aggregate(aggregationPipeline); 
    if(res.json){
        res.json({ 
            success: true,
            trip_list: trip_list,
            total_page:total_page,
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message: '',  
        });
    }else{
        res({ 
            success: true,
            trip_list: trip_list,
            total_page:total_page,
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message: '',  
        });
    }
}

// excel sheet download For complete_trip_report
async function generate_excel_for_rental_trip_report(req, res, array, type, header) {
    let setting_detail = await Setting.findOne({},{history_base_url: 1, timezone_for_display_date:1})
    const currentDate = moment().tz(setting_detail.timezone_for_display_date).format('HHmm_DDMMYYYY');
    let wb = new xl.Workbook();
    let ws = wb.addWorksheet('sheet1');
    let col = 1;
    let typename = 'complete_trip_report';
    let title
        if(header){
            title = JSON.parse(header)
        }else{
            title = {
                id : 'Trip ID',
                user_name: 'User',
                driver_name: 'Driver',
                status : 'Status',
                vehicle_name: 'Service Type',
                date: 'Date',
                amount : 'amount',
                payment : 'Payment',
                payment_status : 'Payment Status',
                title_pay_by_cash : 'Cash',
                title_pay_by_card : 'Card',
                title_pending : 'Pending',
                title_paid : 'Paid',
                title_not_paid : 'Not Paid',
                title_completed: 'Completed',
                title_cancelled: 'Cancelled',
                base_price: 'Base Price',
                distance: 'Distance',
                distance_price: 'Distance Price',
                time: 'Time',
                time_price: 'Time Price',
                waiting_time: 'Waiting Time',
                wait_time_price: 'Waiting Time Price',
                user_tax: 'User Tax',
                tax: 'Tax',
                user_miscellaneous_fee: 'User Miscellaneous Fee',
                tip: 'Tip',
                toll: 'Toll',
                driver_profit: 'Driver Profit',
                driver_tax: 'Driver Tax',
                driver_miscellaneous_fee: 'Driver Miscellaneous Fee',
                pickup_address: 'Pickup Address',
                destination_address: 'Destination Address',
                address: "Address"
            }
        }
        ws.cell(1, col++).string(title.id);
        ws.cell(1, col++).string(title.user_name);
        ws.cell(1, col++).string(title.driver_name);
        ws.cell(1, col++).string(title.status);
        ws.cell(1, col++).string(title.vehicle_name);
        ws.cell(1, col++).string(title.base_price);
        ws.cell(1, col++).string(title.amount);
        ws.cell(1, col++).string(title.driver_profit);
        ws.cell(1, col++).string(title.payment_status);
        ws.cell(1, col++).string(title.date);
        ws.cell(1, col++).string(title.address);

    array.forEach(function (data, index) {
        col = 1;
        
        ws.cell(index + 2, col++).number(data.unique_id);
        
        if (data.user_first_name || data.user_last_name) {
            ws.cell(index + 2, col++).string(data.user_first_name + ' ' + data.user_last_name);
        } else {
            col++   // We have to skip that particular column
        }
            
        if (data.provider_first_name || data.provider_last_name) {
            ws.cell(index + 2, col++).string(data.provider_first_name + ' ' + data.provider_last_name);
        } else {
            col++   // We have to skip that particular column
        }

        if(data.is_trip_cancelled == 1){
            ws.cell(index + 2, col++).string(title.title_cancelled);
        }else{
            ws.cell(index + 2, col++).string(title.title_completed);
        }

        ws.cell(index + 2, col++).string(data.vehicle_name);
        
        ws.cell(index + 2, col++).number(data.base_price);
        
        ws.cell(index + 2, col++).number(data.total);

        ws.cell(index + 2, col++).number(data.provider_service_fees);
        
        if (data.payment_status == 0) {
            ws.cell(index + 2, col++).string(title.title_pending);
        } else {
            if (data.payment_status == 1) {
                ws.cell(index + 2, col++).string(title.title_paid);
            } else {
                ws.cell(index + 2, col++).string(title.title_not_paid);
            }
        }

        ws.cell(index + 2, col++).string(moment(data.user_create_time).tz(setting_detail.timezone_for_display_date).format('DD MMM YYYY HH:mm a'));

        ws.cell(index + 2, col++).string(data.address);

        if (index == array.length - 1) {
            wb.write('data/xlsheet/' + typename + '_' + currentDate + '.xlsx', async function (err) {
                if (err) {
                    console.error(err);
                } else {
                    let url = setting_detail.history_base_url +"/xlsheet/" + typename + '_' + currentDate + '.xlsx';
                    // let url = "http://192.168.0.153:5001/history" +"/xlsheet/" + typename + '_' + currentDate + '.xlsx';

                    if(res.json){
                        res.json(url);
                    }else{
                        res(url);
                    }
                }
            });
        }
    })
}
