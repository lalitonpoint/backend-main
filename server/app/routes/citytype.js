
let citytype = require('../controllers/citytype');
module.exports = function (app) {
    app.route('/typelist_selectedcountrycity').post(citytype.list);
    app.route('/typelist_for_dispatcher').post(citytype.disptcher_city_type_list);
    app.route('/user_city_type_list').post(citytype.list);
};