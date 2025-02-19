let admin = require('../controllers/admin');

module.exports = function (app) {
    app.route('/getlanguages').post(admin.getlanguages);
    app.route('/getsettingdetail').post(admin.getsettingdetail);
    app.route('/generate_firebase_access_token').post(admin.generate_firebase_access_token);
    app.route('/update_unapprove_status').post(admin.update_unapprove_status);

    // for new chat notification
    app.route('/new_chat_notification').post(admin.new_chat_notification);
    
};