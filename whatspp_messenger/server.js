let async = require("async");
let crypto = require('crypto')

setup = require('./config/setup');
global.setting_detail = {};
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
init();

let multer = require('multer');
const path = require('path');

function parallel(middlewares) {
  return function (req, res, next) {
      async.each(middlewares, function (mw, cb) {
          mw(req, res, cb);
      }, next);
  };
} 

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, __dirname + '/data/');
  },
  filename: function (req, file, cb) {
    const originalExt = path.extname(file.originalname); // Get the original file extension
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).readUInt32LE(0);
    cb(null, file.fieldname + '-' + uniqueSuffix + originalExt);
  },
});



async function init() {
    let port = setup.port;

    const express = require('express');
    const bodyParser = require('body-parser');
    const cors = require('cors')
    const http = require('http');

    let mongoose = require('./config/mongoose');

    await mongoose();
    let app = express();
    app.use(cors())

    const upload = multer({ storage: storage, limits: {
      fileSize: 30 * 1024 * 1024, // Limiting file size to 30MB (adjust this value as needed)
    }});
    app.use(parallel([
      express.static('./data', {maxAge: '1d'}),
      bodyParser.json({ limit: '50mb' }),
      bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 1000000 }),
      upload.any(),
    ]));
    
    require('./app/controllers/constant');
    require('./app/controllers/whatsapp');
    
    const whatsappRoute = require('./app/routes/whatsapp.js');
    app.use('/whatsapp',whatsappRoute);
    
    app.get('/check_status', function (req, res) {
      res.sendStatus(200);        
    });

    const server = http.Server(app);
    server.listen(port + (process.env.NODE_APP_INSTANCE ? parseInt(process.env.NODE_APP_INSTANCE) : 0), async () => {
     
    });

    let Settings = require('mongoose').model('Settings');
    Settings.findOne({}, function (error, setting) {
      global.setting_detail = setting
      console.log('Magic happens on port ' + port);
    });
    module.exports = app;
}
