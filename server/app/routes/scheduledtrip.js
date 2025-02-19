let scheduledtrip = require('../../app/controllers/scheduledtrip');
module.exports = function (app) {
    app.route('/getfuturetrip').post(scheduledtrip.getfuturetrip);
    app.route('/cancelscheduledtrip').post(scheduledtrip.cancelScheduledtrip);
};