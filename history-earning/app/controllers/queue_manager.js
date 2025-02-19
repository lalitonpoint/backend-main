const Queue = require('bull');
let export_data_controller = require('./history_controller.js')
let earning_data_controller = require('./earning_controller.js')
let Export_history = require('mongoose').model('export_history');
const utils = require('./utils.js')
const {
    EXPORT_HISTORY_STATUS,
} = require('./constant.js')

// create a new queue instance with a Redis backend
const tripExportRecordsQueue = new Queue("tripExportRecords", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});


const completeTripReportQueue = new Queue("completeTripReport", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

// create a new queue instance with a Redis backend
const earningExportRecordsQueue = new Queue("earningExportRecords", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

// create a new queue instance with a Redis backend
const earningExportRecordsQueueOfTrip = new Queue("earningExportRecordsOfTrip", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});


// create a new queue instance with a Redis backend
const earningExportRecordsQueueOfPartner = new Queue("earningExportRecordsOfPartner", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

const earningExportRecordsQueueOfCorporateCompleteRide = new Queue("earningExportRecordsOfCorporateCompleteRide", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

const earningExportRecordsQueueOfUserWallet = new Queue("earningExportRecordsOfUserWallet", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

const earningExportRecordsQueueOfUserHistory = new Queue("earningExportRecordsOfUserHistory", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

const earningExportRecordsQueueOfProviderWeeklyEarning = new Queue("earningExportRecordsOfProviderWeeklyEarning", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

const earningExportRecordsQueueOfProviderHistory = new Queue("earningExportRecordsOfProviderHistory", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

const tripExportRecordsQueueForPartnerCompleteRide = new Queue("tripExportRecordsForPartnerCompleteRide", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

const tripExportRecordsQueueForTripHistory = new Queue("tripExportRecordsForTripHistory", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

const earningExportRecordsQueueOfDispatcherCompleteHistory = new Queue("earningExportRecordsOfDispatcherCompleteHistory", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

const walletHistoryQueue = new Queue("WalletHistoryExport", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

const earningExportRecordsQueueOfOpenRideUserHistory = new Queue("earningExportRecordsOfOpenRideUserHistory", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

const earningExportRecordsQueueOfOpenRideProviderHistory = new Queue("earningExportRecordsOfOpenRideProviderHistory", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

const tripExportRecordsQueueForOpenRide = new Queue("tripExportRecordsForOpenRide", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

const tripExportRecordsQueueForRentalRide = new Queue("tripExportRecordsQueueForRentalRide", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

const rentalTripReportQueue = new Queue("rentalTripReportQueue", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

// create a new queue instance with a Redis backend
const earningExportRecordsQueueOfRentalTrip = new Queue("earningExportRecordsQueueOfRentalTrip", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});


exports.emptyQueue = function () {
    tripExportRecordsQueue.empty();
    completeTripReportQueue.empty();
    earningExportRecordsQueue.empty();
    earningExportRecordsQueueOfTrip.empty();
    earningExportRecordsQueueOfCorporateCompleteRide.empty();
    earningExportRecordsQueueOfUserWallet.empty();
    earningExportRecordsQueueOfUserHistory.empty();
    earningExportRecordsQueueOfProviderWeeklyEarning.empty();
    earningExportRecordsQueueOfProviderHistory.empty();
    tripExportRecordsQueueForPartnerCompleteRide.empty();
    tripExportRecordsQueueForTripHistory.empty();
    earningExportRecordsQueueOfDispatcherCompleteHistory.empty();
    walletHistoryQueue.empty();
    earningExportRecordsQueueOfOpenRideUserHistory.empty();
    earningExportRecordsQueueOfOpenRideProviderHistory.empty();
    tripExportRecordsQueueForOpenRide.empty();
    tripExportRecordsQueueForRentalRide.empty();
    rentalTripReportQueue.empty();
    earningExportRecordsQueueOfRentalTrip.empty();
}

exports.init = function (err, res) {
    // process the jobs in the queue
    tripExportRecordsQueue.process(async (job, done) => {
        job.data.jobid = job.id;
        await export_data_controller.get_trip_data(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();

                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)

            })
            done()
        });
    });

    // listen for the progress event of the job
    tripExportRecordsQueue.on('progress', (job, progress) => {
        console.log(`Job ${job.id} is ${progress}% complete`);
    });

 
    completeTripReportQueue.process(async (job, done) => {
        job.data.jobid = job.id;
        if (job.data.is_open_ride) {
            await export_data_controller.get_open_ride_report(job.data, async function (res) {
                Export_history.findOne({ unique_id: job.id }).then((export_data) => {
                    export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                    export_data.url = res
                    export_data.save()

                    let json = {
                        type: export_data.type,
                        url: res
                    }
                    utils.export_file_socket(json)
                })

                done()
            })
        } else {
            await export_data_controller.get_trip_report_data(job.data, async function(res){
                Export_history.findOne({unique_id: job.id}).then((export_data) => {
                    export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                    export_data.url = res
                    export_data.save();
    
                    let json = {
                        type : export_data.type,
                        url : res
                    }
                    utils.export_file_socket(json)
                })
               
                done()
            })
        }
    })

    // listen for the progress event of the job
    completeTripReportQueue.on('progress', (job, progress) => {
        console.log(`Job ${job.id} is ${progress}% complete`);
    });

    walletHistoryQueue.process(async (job, done) => {
        job.data.jobid = job.id;
        await earning_data_controller.get_wallet_history_data(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                console.log(res)
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();

            })
            done()
        });
    });

    // listen for the progress event of the job
    walletHistoryQueue.on('progress', (job, progress) => {
        console.log(`Job ${job.id} is ${progress}% complete`);
    });

    // process the jobs in the queue
    earningExportRecordsQueue.process(async (job, done) => {
        job.data.jobid = job.id;
        await earning_data_controller.weekly_and_daily_earning_req_post(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();

                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)
            })
            done()
        });
    });

    earningExportRecordsQueueOfTrip.process(async (job, done) => {
        job.data.jobid = job.id;
        await earning_data_controller.trip_earning_req_post(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();

                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)
            })
            done()
        });
    });

    earningExportRecordsQueueOfPartner.process(async (job, done) => {
        job.data.jobid = job.id;
        await earning_data_controller.partner_weekly_earning_req_post(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();

                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)
            })
            done()
        });
    });

    earningExportRecordsQueueOfCorporateCompleteRide.process(async (job, done) => {
        job.data.jobid = job.id;
        await export_data_controller.history_req_post_in_corporate(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();

                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)
            })
            done()
        });
    });

    earningExportRecordsQueueOfUserWallet.process(async (job, done) => {
        job.data.jobid = job.id;
        await earning_data_controller.wallet_history_req_post(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();

                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)
            })
            done()
        });
    });

    earningExportRecordsQueueOfUserHistory.process(async (job, done) => {
        job.data.jobid = job.id;
        await export_data_controller.user_history_req_post(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();

                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)
            })
            done()
        });
    });

    earningExportRecordsQueueOfProviderWeeklyEarning.process(async (job, done) => {
        job.data.jobid = job.id;
        await earning_data_controller.get_web_provider_weekly_earning_detail_req_post(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();


                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)
            })
            done()
        });
    });

    earningExportRecordsQueueOfProviderHistory.process(async (job, done) => {
        job.data.jobid = job.id;
        await export_data_controller.provider_history_req_body(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();


                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)

            })
            done()
        });
    });

    tripExportRecordsQueueForPartnerCompleteRide.process(async (job, done) => {
        job.data.jobid = job.id;
        await export_data_controller.complete_request_req_post(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();

                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)

            })
            done()
        });
    });

    tripExportRecordsQueueForTripHistory.process(async (job, done) => {
        job.data.jobid = job.id;
        await export_data_controller.service_type_trip_list_req_post(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();

                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)

            })
            done()
        });
    });

    earningExportRecordsQueueOfDispatcherCompleteHistory.process(async (job, done) => {
        job.data.jobid = job.id;
        await export_data_controller.history_req_post(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();

                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)

            })
            done()
        });
    });

    earningExportRecordsQueueOfOpenRideUserHistory.process(async (job, done) => {
        job.data.jobid = job.id;
        await export_data_controller.openride_user_history_req_post(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();

                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)
            })
            done()
        });
    });

    earningExportRecordsQueueOfOpenRideProviderHistory.process(async (job, done) => {
        job.data.jobid = job.id;
        await export_data_controller.openride_provider_history_req_body(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();


                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)

            })
            done()
        });
    });

    tripExportRecordsQueueForOpenRide.process(async (job, done) => {
        job.data.jobid = job.id;
        await export_data_controller.openride_get_trip_list_res(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();

                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)

            })
            done()
        });
    });

    // listen for the progress event of the job
    tripExportRecordsQueueForOpenRide.on('progress', (job, progress) => {
        console.log(`Job ${job.id} is ${progress}% complete`);
    });

    tripExportRecordsQueueForRentalRide.process(async (job, done) => {
        job.data.jobid = job.id;
        await export_data_controller.get_rental_trip_list_res(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();

                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)
            })
            done()
        });
    });

    rentalTripReportQueue.process(async (job, done) => {
        job.data.jobid = job.id;
        await export_data_controller.get_rental_trip_report_data(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();

                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)
            })
            done()
        });
    });

    earningExportRecordsQueueOfRentalTrip.process(async (job, done) => {
        job.data.jobid = job.id;
        await earning_data_controller.rental_trip_earning_req_post(job.data, async function(res){
            Export_history.findOne({unique_id: job.id}).then((export_data) => {
                export_data.status = EXPORT_HISTORY_STATUS.COMPLETED
                export_data.url = res
                export_data.save();

                let json = {
                    type : export_data.type,
                    url : res
                }
                utils.export_file_socket(json)
            })
            done()
        });
    });

}


exports.tripExportQueue = tripExportRecordsQueue
exports.completeTripReportQueue = completeTripReportQueue
exports.earningExportQueue = earningExportRecordsQueue
exports.earningExportQueueOfTrip = earningExportRecordsQueueOfTrip
exports.earningExportQueueOfPartner = earningExportRecordsQueueOfPartner
exports.earningExportQueueOfCorporateCompleteRide = earningExportRecordsQueueOfCorporateCompleteRide
exports.earningExportQueueOfUserWallet = earningExportRecordsQueueOfUserWallet
exports.earningExportQueueOfUserHistory = earningExportRecordsQueueOfUserHistory
exports.earningExportQueueOfProviderWeeklyEarning = earningExportRecordsQueueOfProviderWeeklyEarning
exports.earningExportQueueOfProviderHistory = earningExportRecordsQueueOfProviderHistory
exports.tripExportQueueForPartnerCompleteRide = tripExportRecordsQueueForPartnerCompleteRide
exports.tripExportQueueForTripHistory = tripExportRecordsQueueForTripHistory
exports.earningExportQueueOfDispatcherCompleteHistory = earningExportRecordsQueueOfDispatcherCompleteHistory
exports.walletHistoryQueue = walletHistoryQueue
exports.earningExportQueueOfOpenRideUserHistory = earningExportRecordsQueueOfOpenRideUserHistory
exports.earningExportQueueOfOpenRideProviderHistory = earningExportRecordsQueueOfOpenRideProviderHistory
exports.tripExportQueueForOpenRide = tripExportRecordsQueueForOpenRide
exports.tripExportRecordsQueueForRentalRide = tripExportRecordsQueueForRentalRide
exports.rentalTripReportQueue = rentalTripReportQueue
exports.earningExportRecordsQueueOfRentalTrip = earningExportRecordsQueueOfRentalTrip