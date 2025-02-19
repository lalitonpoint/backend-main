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


function init() {
    let port = 8000;
    require('./config/config')
    let mongoose = require('./config/mongoose')
    // prometheus = require('./config/prometheus'),
    let express = require('./config/express_cron')
    db = mongoose()
    let app = express();
    //Old Code: app.listen(port);

    global.config_json = require('./config/strings/admin_panel_string.json');
    global.admin_messages = require('./config/strings/admin_panel_message.json');
    global.constant_json = require('./config/strings/constants.json');
    global.push_messages = require('./config/strings/pushMessages.json');
    global.error_message = require('./config/strings/errorMessages.json');
    global.success_messages = require('./config/strings/successMessages.json');


    //Old Code: require('./config/socket');

    const http = require('http');
    const socketIO = require('socket.io');
    const server = http.Server(app);

    server.listen(port + (process.env.NODE_APP_INSTANCE ? parseInt(process.env.NODE_APP_INSTANCE) : 0), async () => {
  
      const io = socketIO(server);
      global.socket_object = io;
      
      const { createClient } = require("redis");
      const { createAdapter } = require("@socket.io/redis-adapter");
      const pubClient = createClient({ url: "redis://localhost:6379" });
      pubClient.on('error', (err) => console.log('Redis Client Error', err));
      await pubClient.connect();

      const subClient = pubClient.duplicate();
      
      io.adapter(createAdapter(pubClient, subClient));

      io.on('connection', socket => {
      });
    });

    //Old Code: app.use('/metrics', prometheus.metricsHandler)
    //require('./app/controllers/constant')

    app.get('*', function (req, res) {
      res.render('errorPage');
    });

    //Old Code: app.use(prometheus.errorsHandler)

    let Settings = require('mongoose').model('Settings');
    Settings.findOne({}, function (error, setting) {
        global.setting_detail = setting
        console.log('Magic happens on port ' + port);
    });

    module.exports = app;
}



