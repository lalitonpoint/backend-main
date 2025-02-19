let config = require('./config'),
mongoose = require('mongoose');
mongoose.Promise = global.Promise;
let autoIncrement = require('mongoose-id-autoincrement');


module.exports = function () {
    let db;
    // set -> export MONGODB_URL=mongodb://localhost:27017/<<db_name>>
    // get -> echo $MONGODB_URL
    console.log(`server.process.env.MONGODB_URL : ${process.env.MONGODB_URL}`)
    config.db = process.env.MONGODB_URL || config.db;
    console.log(`server.config.db : ${config.db}`)
    if(config.db){
        db = mongoose.connect(config.db,{
            useUnifiedTopology: true,
            useNewUrlParser: true
        });
        // console.log(config.db)
        
    } else {
        let host = "207.148.68.154";
        let username = "root";
        let password = "e5E+BTU93A]!_F%5";
        
        // For Live
        // let host = "45.76.155.149";
        // let password = "oQ]9kekCdX1,7TyT";
        
        let keyconfig = {
            "username": username, // vultr
            "password": password , // dev
            "host": host, // wowdev
            "port": 22,
            "dstHost": "127.0.0.1",
            "dstPort": 27017,
            "localHost": "127.0.0.1",
            "localPort": 27000,
            "keepAlive":true,
        }
        const tunnel = require('tunnel-ssh');
        // let server = tunnel({ ...keyconfig, privateKey: fs.readFileSync(keyconfig.keyPath) }, function (error, server) {
        let server = tunnel({ ...keyconfig }, function (error, server) {
            db = mongoose.connect('mongodb://localhost:27000/NEW_EBER_LOCAL_CLEAN_DB', {}) // wowdev CLEAN DB 
            // db = mongoose.connect('mongodb://localhost:27000/EBER', {}) // wowlive DB 
        });

        server.on('error', function(err){
            console.error('Something bad happened:', err);
        });
    }
    autoIncrement.initialize(mongoose.connection);

    require('../app/models/user');
    require('../app/models/provider');
    require('../app/models/country');
    require('../app/models/city');
    require('../app/models/type');
    require('../app/models/citytype');
    require('../app/models/trip');
    require('../app/models/card');
    require('../app/models/trip_service');
    require('../app/models/trip_history');
    require('../app/models/reviews');
    require('../app/models/trip_location');
    require('../app/models/promo_code');
    require('../app/models/user_promo_used');
    require('../app/models/documents');
    require('../app/models/provider_document');
    require('../app/models/provider_vehicle_document');
    require('../app/models/user_document');
    require('../app/models/admin');
    require('../app/models/admin_settings');
    require('../app/models/information');
    require('../app/models/payment_transaction');
    require('../app/models/sms_detail');
    require('../app/models/email_detail');
    require('../app/models/emergency_contact_detail');
    require('../app/models/provider_daily_earning');
    require('../app/models/provider_weekly_earning');
    require('../app/models/partner_weekly_earning');
    require('../app/models/partner');
    require('../app/models/dispatcher');
    require('../app/models/bank_detail');
    require('../app/models/hotel');
    require('../app/models/citytocity');
    require('../app/models/airport');
    require('../app/models/airporttocity');
    require('../app/models/cityzone');
    require('../app/models/redzone_area');
    require('../app/models/zonevalue');
    require('../app/models/wallet_history');
    require('../app/models/provider_daily_analytic');
    require('../app/models/languages');
    require('../app/models/corporate');
    require('../app/models/redeem_point_history');

    // 28 May //
    
    require('../app/models/partner_vehicle_document');
    require('../app/models/transfer_history');
    require('../app/models/guest_token');

    // mass_notification
    require('../app/models/mass_notification')
    require('../app/models/cancellation_reasons')
    require('../app/models/change_log')
    //find_provider_logs
    require('../app/models/find_provider_logs')

    // Admin notifications
    require('../app/models/admin_notification')

    // Admin profit with corporate and hotel data
    require('../app/models/admin_profit')

    // Vehicle model
    require('../app/models/vehicle')
    require('../app/models/vehicle_brand')
    require('../app/models/vehicle_model')
    
    // Car Rent Service
    require('../app/models/car_rent_type')
    require('../app/models/car_rent_brand')
    require('../app/models/car_rent_model')
    require('../app/models/car_rent_feature')
    require('../app/models/car_rent_specification')
    require('../app/models/car_rent_vehicle')
    require('../app/models/rental_trip')

    // Hub model
    require('../app/models/hub')
    
    // Hub User
    require('../app/models/hub_user')
    
    // Vehicle history model
    require('../app/models/vehicle_history')

    require('../app/models/otp')

    // Open Ride
    require('../app/models/open_ride')

    require('../app/models/banner');

    return db;
};
