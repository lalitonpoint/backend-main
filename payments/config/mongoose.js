let config = require('./config'),
mongoose = require('mongoose');
mongoose.Promise = global.Promise;
let autoIncrement = require('mongoose-id-autoincrement');

let localport = 27002   // Changed to 27002 from 27001 because history-earning server is running on 27001 and due to which error was occuring
let is_used = false
module.exports = async function () {
    let db;
    // set -> export MONGODB_URL=mongodb://localhost:27017/<<db_name>>
    // get -> echo $MONGODB_URL
    console.log(`payments.process.env.MONGODB_URL : ${process.env.MONGODB_URL}`)
    config.db = process.env.MONGODB_URL || config.db;
    console.log(`payments.config.db : ${config.db}`)
    if(config.db){
        db = mongoose.connect(config.db,{
            useUnifiedTopology: true,
            useNewUrlParser: true
        });
        console.log(config.db)
    } else {
        is_used = true;
        let keypath = "";
        let host = "207.148.68.154";
        let username = "root";
        let password = "e5E+BTU93A]!_F%5";
        let keyconfig = {
            "username": username, // vultr
            "password": password, // dev
            "host": host, // OnPointdev
            "port": 22,
            "dstHost": "127.0.0.1",
            "dstPort": 27017,
            "localHost": "127.0.0.1",
            "localPort": localport,
            "keepAlive":true,
            "keyPath": keypath
        }
        const tunnel = require('tunnel-ssh');
        // const fs = require('fs');
        // let server = tunnel({ ...keyconfig, privateKey: fs.readFileSync(keyconfig.keyPath) }, function (error, server) {
        let server = tunnel({ ...keyconfig }, function (error, server) {
            // db = mongoose.connect('mongodb://localhost:27000/staging', {}) //OnPointstaging
            // db = mongoose.connect('mongodb://localhost:27000/EBER_LOCAL_NEW', {}) // OnPointdev
            // db = mongoose.connect('mongodb://localhost:'+localport+'/NEW_EBER_LOCAL', {}) // OnPointdev
            // db = mongoose.connect('mongodb://localhost:27000/EBER', {}) // OnPointlive 
            db = mongoose.connect('mongodb://localhost:'+localport+'/NEW_EBER_LOCAL_CLEAN_DB', {})// OnPointdev CLEAN DB 
        });


        server.on('error', function(err){
            console.error('Something bad happened:', err);
        });
    }

    autoIncrement.initialize(mongoose.connection);

    require('../app/models/admin_settings');

    setup = require('./setup');
    await setup.importMongooseModels(setup.database_models);

    require('../app/models/trip');
    require('../app/models/trip_history');
    require('../app/models/user');
    require('../app/models/provider');
    require('../app/models/card');
    require('../app/models/city');
    require('../app/models/partner');
    require('../app/models/corporate');
    require('../app/models/country');
    require('../app/models/wallet_history');
    require('../app/models/rental_trip');
    require('../app/models/car_rent_vehicle');

    return db;
};
