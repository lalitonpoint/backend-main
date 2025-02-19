setup = require('./config/setup');
global.setting_detail = {};
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
if (process.env.NODE_ENV == 'production') {
  let cluster = require('cluster');
  if (cluster.isMaster) {
    // Count the machine's CPUs
    let cpuCount = require('os').cpus().length; 

    // Create a worker for each CPU
    for (let i = 0; i < cpuCount; i += 1) {
      cluster.fork();
    }
    // Code to run if we're in a worker process
  } else {
    init();
  }
} else {
  init();
}

async function init() {
  setTimeout(async() => {
    let port = setup.port;

    const express = require('express');
    const bodyParser = require('body-parser');
    const cors = require('cors')
    const http = require('http');
    const middleware = require('./config/middleware');
    let mongoose = require('./config/mongoose');

    await mongoose()
    let app = express();
    app.use(cors())
    global.constant_json = require('./constants.json');
    
    app.use([
      express.static('./data', {maxAge: '1d'}),
      bodyParser.json({limit: '50mb'}),
      bodyParser.urlencoded({limit: "50mb",extended: true, parameterLimit: 1000000}),
    ]);
    
    app.use('*', middleware.decryptRequest, middleware.encryptResponse)

    app.use('/history',[
      express.static('./data', {maxAge: '1d'}),
    ]);

    app.get('/check_status', function (req, res) {
      res.sendStatus(200);        
    });

    //Unused Code: require('./app/controllers/constant');
    global.error_message = require('./errorMessages.json');
    global.success_messages = require('./successMessages.json');
    
    const exportssRoute = require('./app/routes/history_route');
    app.use('/history', middlewares, exportssRoute);

    const earning_route = require('./app/routes/earning_route');
    app.use('/earning', middlewares, earning_route);
    
    // initialize queue manager
    let queue_manager = require('./app/controllers/queue_manager')
    queue_manager.init();
    
    const server = http.Server(app);
    server.listen(port + (process.env.NODE_APP_INSTANCE ? parseInt(process.env.NODE_APP_INSTANCE) : 0), async () => {

      const io = require('socket.io')(server, {
        cors: {
          origin: '*',
        }
      });
      io.on('connection', socket => {
        console.log(" connected");
      });
      
    });

    let Settings = require('mongoose').model('Settings');
    Settings.findOne({}, function (error, setting) {
      global.setting_detail = setting
      console.log('Magic happens on port'  + port);
    });
    module.exports = app;
  }, 3000);
}

// middleware auth function 
async function middlewares(req, res, next) {
  let utils = require('./app/controllers/utils');
  const {
    ERROR_CODE
  } = require('./app/utils/error_code')
  let type = req.headers.type
  let id = req.headers.admin_id
  let token = req.headers.token
  if (type == '1') {
    let response = await utils.check_auth_middleware(id, token)
    if (!response.success) {
        let error_code = ERROR_CODE.INVALID_SERVER_TOKEN
        res.json({ success: false, error_code: error_code })
        return
    }
    req.headers.is_show_email = response.is_show_email
    req.headers.is_show_phone = response.is_show_phone
  
    req.headers.is_country_based_access_control_enabled = response.is_country_based_access_control_enabled
    req.headers.allowed_countries = response.allowed_countries
    req.headers.is_city_based_access_control_enabled = response.is_city_based_access_control_enabled
    req.headers.allowed_cities = response.allowed_cities
    req.headers.countries = response.countries
    req.headers.cities = response.cities
  }

  next()
}
