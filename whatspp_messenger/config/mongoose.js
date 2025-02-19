let config = require('./config'),
mongoose = require('mongoose');
mongoose.Promise = global.Promise;


let localport = 27004
module.exports = async function () {
    let db;
    console.log(`server.process.env.MONGODB_URL : ${process.env.MONGODB_URL}`)
    config.db = process.env.MONGODB_URL || config.db;

    if(config.db){

    db = mongoose.connect(config.db,{
        useUnifiedTopology: true,
        useNewUrlParser: true
      });
    }else {
        let keypath = "";
        let host = "207.148.68.154";
        let username = "root";
        let password = "e5E+BTU93A]!_F%5";
        let keyconfig = {
            "username": username, // vultr
            "password": password, // dev
            "host": host, // wowdev
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
            // db = mongoose.connect('mongodb://localhost:27000/staging', {}) //wowstaging
            // db = mongoose.connect('mongodb://localhost:27000/EBER_LOCAL_NEW', {}) // wowdev
            // db = mongoose.connect('mongodb://localhost:'+localport+'/NEW_EBER_LOCAL', {}) // wowdev
            // db = mongoose.connect('mongodb://localhost:27000/EBER', {}) // eber live 
            db = mongoose.connect('mongodb://localhost:'+localport+'/NEW_EBER_LOCAL_CLEAN_DB', {})// wowdev CLEAN DB 
        });


        server.on('error', function(err){
            console.error('Something bad happened:', err);
        });
        
    }

    console.log(config.db)
    require('../app/models/admin_settings');

    setup = require('./setup');
    await setup.importMongooseModels(setup.database_models);
    return db;
};
