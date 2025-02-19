let guest_token = require('../controllers/guest_token');
module.exports = function (app) {
    app.route('/track-trip_new').get(guest_token.track_trip_new);
};