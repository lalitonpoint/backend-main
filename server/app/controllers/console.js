let winston = require('winston');
require('winston-daily-rotate-file');
let Settings = require('mongoose').model('Settings')

let transport = new (winston.transports.DailyRotateFile)({
    filename: './log_files/application-%DATE%.log',
    datePattern: 'YYYY-MM-DD-HH',
    maxSize: '100m'
});


const logger = winston.createLogger({
     transports: [
      transport
     ]
 });


exports.log = async function (value) {
    const setting_detail = await Settings.findOne({});

    if(setting_detail.is_debug_log){
        logger.info(value); 
        console.log(value)
    }
}

exports.error = async function (value) {
    const setting_detail = await Settings.findOne({});

    if(setting_detail.is_debug_log){
        logger.error(value);
    }
}



exports.trace = async function (value) {
    const setting_detail = await Settings.findOne({});
    
    if(setting_detail.is_debug_log){
        console.trace(value)
    }
}