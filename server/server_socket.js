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
    let port = 6000;
    require('./config/config')
    let mongoose = require('./config/mongoose')
    let express = require('./config/express_socket')
    mongoose()
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

      let Providers = require('./app/controllers/providers');
      io.adapter(createAdapter(pubClient, subClient));

      io.on('connection', socket => {
        socket.on('update_location', function (data, ackFn) {
          let trip_id ="'"+data.trip_id+"'";
          let provider_id ="'"+data.provider_id+"'";
          Providers.update_location_socket({body: data}, function(response){
            if(typeof ackFn == "function"){
              ackFn(response);
            }
            if(data.trip_id && response.success){
              io.emit(trip_id , {is_trip_updated: false, trip_id: trip_id, "bearing": data.bearing, "location": response.providerLocation, "total_time": response.total_time, "total_distance": response.total_distance, "location_array": data.location});
            } else {
              io.emit(provider_id , {"bearing": data.bearing, "location": response.providerLocation, provider_id: data.provider_id, "location_array": data.location});
            }
          });
        });
      });
    });

    //Old Code: app.use('/metrics', prometheus.metricsHandler)

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



