let demo = require('../controllers/demo');

module.exports = function (app) {
    app.route('/add_detail').post(demo.add_detail);
    app.route('/check_service_type').post(demo.check_service_type);
    app.route('/get_country_list').get(demo.get_country_list);
    app.route('/type_list').post(demo.type_list);
    app.route('/fetch_country_detail').post(demo.fetch_country_detail);
    app.route('/check_country_exists').post(demo.check_country_exists);
    app.route('/check_city').post(demo.check_city);
};