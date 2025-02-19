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
    
    app.use([
      express.static('./data', {maxAge: '1d'}),
      bodyParser.json({limit: '50mb'}),
      bodyParser.urlencoded({limit: "50mb",extended: true, parameterLimit: 1000000}),
    ]);
    
    global.error_message = require('./errorMessages.json');
    global.success_messages = require('./successMessages.json');
    global.constant_json = require('./constants.json');
    global.push_messages = require('./pushMessages.json');
    
    app.use('*', middleware.decryptRequest, middleware.encryptResponse)
    
    const paymentsRoute = require('./app/routes/payments_route');
    app.use('/payments',paymentsRoute);
    
    app.get('/check_status', function (req, res) {
      res.sendStatus(200);        
    });

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
      console.log('Magic happens on port' + port);
    });
    module.exports = app;
  }, 3000);
}
