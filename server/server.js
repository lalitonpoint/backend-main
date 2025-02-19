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

// Unused code
// var CityZone = require('mongoose').model('CityZone');
// const UserController = require('./app/controllers/users')

function init() {
    let port = 5000;
    require('./config/config')
    let mongoose = require('./config/mongoose')
    let express = require('./config/express')
    db = mongoose()
    let app = express();

    global.config_json = require('./config/strings/admin_panel_string.json');
    global.admin_messages = require('./config/strings/admin_panel_message.json');
    global.constant_json = require('./config/strings/constants.json');
    global.push_messages = require('./config/strings/pushMessages.json');
    global.error_message = require('./config/strings/errorMessages.json');
    global.success_messages = require('./config/strings/successMessages.json');
    //Old Code: require('./config/socket');

    const http = require('http');
    //Old Code: const socketIO = require('socket.io');
    const server = http.Server(app);

    server.listen(port + (process.env.NODE_APP_INSTANCE ? parseInt(process.env.NODE_APP_INSTANCE) : 0), async () => {
  
      const io = require('socket.io')(server, {
        cors: {
          origin: '*',
        }
      });
  
      
      const { createClient } = require("redis");
      const { createAdapter } = require("@socket.io/redis-adapter");
      const { Emitter } = require("@socket.io/redis-emitter");
      const pubClient = createClient({ url: "redis://localhost:6379" });
      pubClient.on('error', (err) => console.log('Redis Client Error', err));
      const subClient = pubClient.duplicate();
      await pubClient.connect();
      await subClient.connect();
      const emitter = new Emitter(pubClient);
      global.socket_object = emitter;

      let Providers = require('./app/controllers/providers');


      //Old Code: let mongoose = require('mongoose')



      io.adapter(createAdapter(pubClient, subClient));

      io.on('connection', socket => {
        // Handle room joining
        socket.on('room', (room) => {
          socket.join(room);
        });
        
        // Remove from room
        socket.on('removeRoom', (room) => {
          socket.leave(room);
        });

        socket.on('update_location', function (data, ackFn) {
          let provider_id = "'" + data.provider_id + "'";
          let data_trip_id = "'" + data.trip_id + "'";
          Providers.update_location_socket({ body: data }, function (responses) {
            responses.forEach(async (response, index) => {
              if (response.trip_id && response.success) {
                let trip_id = "'" + response.trip_id.toString() + "'";
                if (data_trip_id == trip_id && typeof ackFn == "function") {
                  ackFn(response);
                }
                io.to(trip_id).emit(trip_id, { is_trip_updated: false, trip_id: trip_id, "bearing": data.bearing, "location": response.providerLocation, "total_time": response.total_time, "total_distance": response.total_distance, "location_array": data.location });

              } else {
                if(index == 0){
                  if(response.zone_queue_id){
                    let CityZone = require('mongoose').model('CityZone')
                    let city_zone_data = await CityZone.findOne({ _id: response.zone_queue_id });
                    if(city_zone_data){
                      let provider_index = city_zone_data.total_provider_in_zone_queue.indexOf(data.provider_id)
                      if(provider_index!==-1){
                        response.zone_queue_number = provider_index+1;
                        response.zone_name = city_zone_data.title;
                      }
                    }
                  }
                  if (typeof ackFn == "function") {
                    ackFn(response);
                  }
                  io.to(provider_id).emit(provider_id, { "bearing": data.bearing, "location": response.providerLocation, provider_id: data.provider_id, "location_array": data.location });
                }
              }
              io.to("admin_panel").emit("provider_state_update", { 
                provider_id: data.provider_id, 
                providerLocation: response.providerLocation,
                is_active: response.is_active,
                is_available: response.is_available
              });
            })
          });
        });
      });
    });

    app.post('/check_language', function (req, res) {
      res.json({success:true});        
    });

    app.post('/change_language', function (req, res) {

      let cookieOptions = {
       httpOnly: true,
        expires:new Date(new Date().getTime()+86409000),
        maxAge:86409000
      }
      res.cookie('language', req.body.language, cookieOptions);
      res.json({ success: true });
    });

    let Settings = require('mongoose').model('Settings');
    Settings.findOne({}, function (error, setting) {
        global.setting_detail = setting
        try {
          let admin = require("firebase-admin");
          let serviceAccount = {
            "type": setting_detail.type,
            "project_id": setting_detail.firebase_projectId,
            "private_key_id": setting_detail.private_key_id,
            "private_key": setting_detail.private_key,
            "client_email": setting_detail.client_email,
            "client_id": setting_detail.client_id,
            "auth_uri": setting_detail.auth_uri,
            "token_uri": setting_detail.token_uri,
            "auth_provider_x509_cert_url": setting_detail.auth_provider_x509_cert_url,
            "client_x509_cert_url": setting_detail.client_x509_cert_url
          };

          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: setting_detail.firebase_databaseURL
          });

          global.fireUser = admin.auth();
          global.fireDB = admin.database(); 
        } catch (error) {
          console.log("firebase security configs remainings")
        }

        console.log('Magic happens on port :' +  port);
    });

    module.exports = app;
}



