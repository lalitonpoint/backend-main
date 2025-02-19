let country = require('../controllers/country');
module.exports = function (app) {
    app.route('/countries').get(country.country_list);
    app.route('/country_list').get(country.countries_list);    
    app.route('/countries').post(country.country_list);
    app.route('/country_list').post(country.countries_list);
    app.route('/get_country_city_list').post(country.get_country_city_list);
    app.route('/get_all_country_details').get(country.get_all_country_details);
};