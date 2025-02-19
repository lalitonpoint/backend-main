let city = require('../controllers/city');
module.exports = function (app) {
    app.route('/citilist_selectedcountry').post(city.citylist);
};