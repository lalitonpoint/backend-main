let config = require('./config');
let express = require('express');
let bodyParser = require('body-parser');
let multer = require('multer');
let cons = require('consolidate');
let session = require("express-session");
let moment = require('moment');
let twilio = require('twilio');
let nodemailer = require('nodemailer');
let path = require("path");
let compression = require('compression');
let async = require("async");
let cookieParser = require('cookie-parser')
let app = express();

function parallel(middlewares) {
    return function (req, res, next) {
        async.each(middlewares, function (mw, cb) {
            mw(req, res, cb);
        }, next);
    };
}

module.exports = function (prometheusMiddleware) {

    if (process.env.NODE_ENV == 'development') {
        ///// FOR SESSION SET /////
        app.use(session({resave: true, saveUninitialized: true, secret: 'SOMERANDOMSECRETHERE', maxAge: '1h'}));

    } else if (process.env.NODE_ENV == 'production') {
        let RedisStore = require('connect-redis')(session);
        let { createClient } = require("redis")
        let client = createClient({ legacyMode: true })
        client.connect().catch(console.error)

        ///// FOR SESSION SET /////
        app.use(session({resave: true, saveUninitialized: true, secret: 'SOMERANDOMSECRETHERE', maxAge: '1h', store: new RedisStore({host: 'localhost', port: 6379, client: client, ttl: 1440})}));
    }

    app.use(parallel([
        express.static('./public', {maxAge: '1y'}),
        express.static('./data', {maxAge: '1d'}),
        compression(),
        bodyParser.json({limit: '50mb'}),
        bodyParser.urlencoded({limit: "50mb",extended: true, parameterLimit: 1000000}),
        multer({dest: __dirname + '/data/',limits: {
            fileSize: 30 * 1024 * 1024, // Limiting file size to 30MB (adjust this value as needed)
        }}).any()
    ]));

    // Old Code: app.use(morgan('tiny'));
    app.use(cookieParser());
    
    app.set('views', ['./app/views', './app/views/new_design_user','./app/views/user', './app/views/provider','./app/views/partner','./app/views/new_design_dispatcher','./app/views/dispatcher', './app/views/corporate']);///This line defines where our HTML files are placed so that Server can locate and render them ! Easy enough.
    app.engine('html', require('ejs').renderFile, cons.swig);
    app.set('view engine', 'html');//This line set the view engine or simply presentation factor to EJS which is responsible for HTML rendering.


    return app;
};
