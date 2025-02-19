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
const i18n = require("i18n");
let cors = require('cors')
const flash = require('connect-flash');
let middleware = require('./middleware');

i18n.configure({
    locales: ['en', 'ja', 'fr', 'es', 'ar', 'pr'],
    defaultLocale: 'en',
    directory: __dirname + '/locales',
    cookie: "language",
    updateFiles: false,
    syncFiles: false
});

function parallel(middlewares) {
    return function (req, res, next) {
        async.each(middlewares, function (mw, cb) {
            mw(req, res, cb);
        }, next);
    };
}

module.exports = function () {
    app.use(cors())

    //  if  somone put "/" behind url then show 404  
    app.use(function(req, res, next) {
        if (req.path.slice(-1) == '/' && req.path.length > 1) {
           res.send('<h1 style="display:flex;justify-content:center;"> 404 PAGE NOT FOUND </h1>');
        } else {
           next();
        }
    });
  
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
    app.use(cookieParser());
    app.enable('trust proxy');
    app.use(i18n.init);
    app.use(flash());

    // app.set('views', ['./public/guest_token', './app/views', './app/views/new_design_user','./app/views/user', './app/views/provider','./app/views/partner','./app/views/new_design_dispatcher','./app/views/dispatcher', './app/views/corporate']);///This line defines where our HTML files are placed so that Server can locate and render them ! Easy enough.
    app.engine('html', require('ejs').renderFile, cons.swig);
    app.set('view engine', 'html');//This line set the view engine or simply presentation factor to EJS which is responsible for HTML rendering.

    app.get('/check_status', function (req, res) {
        res.sendStatus(200);        
    });

    app.use('*', middleware.decryptRequest, middleware.modifyResponseMiddleware, middleware.encryptResponse)

    require('../app/routes/admin')(app);
    require('../app/routes/country')(app);
    require('../app/routes/city')(app);
    require('../app/routes/citytype')(app);
    require('../app/routes/users')(app);
    require('../app/routes/providers')(app);
    require('../app/routes/trip')(app);
    require('../app/routes/scheduledtrip')(app);
    require('../app/routes/providerdocument')(app);
    require('../app/routes/userdocument')(app);
    require('../app/routes/emergency_contact_detail')(app);
    require('../app/routes/cron')(app);
    require('../app/routes/provider_earning')(app);
    require('../app/routes/bank_detail')(app);
    require('../app/routes/guest_token')(app);
    require('../app/routes/open_rides')(app);
    require('../app/routes/demo')(app);

    // new wow version
    app.use('',require('../app/index'))

    // if path not found then show 404 error
    app.get('**',(req,res)=>{
        res.send('<h1 style="display:flex;justify-content:center;"> 404 PAGE NOT FOUND </h1>');
    })

    return app;
};