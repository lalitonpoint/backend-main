let router = require('express').Router()
let utils = require('./controllers/utils')
const {
    ERROR_CODE,
} = require('./utils/error_code')

// middleware auth function 
async function middlewares(req, res, next) {

    if (req.path != '/login' && req.path != '/forgot_password' && req.path != '/register' && req.path != '/update_password' && req.path != '/get_language_list' && req.path != '/get_mongoose_models' && req.path != '/add_new_admin_details' && req.path != '/add_string' && req.path != '/get_guest_token'  && req.path != '/get_admin_setting_detail'  && req.path != '/check_subscription' && req.path != '/create_subscription_session' && req.path != '/subscription_webhook' && req.path != '/get_country_city_list')  {
        let type = req.headers.type
        let id = req.headers.admin_id
        let token = req.headers.token
        if (!type || !id || !token) {
            let error_code = ERROR_CODE.INVALID_SERVER_TOKEN
            res.json({ success: false, error_code: error_code })
            return
        }
        let response = await utils.check_auth_middleware(type, id, token)
        if (!response.success) {
            let error_code = ERROR_CODE.INVALID_SERVER_TOKEN
            res.json({ success: false, error_code: error_code })
            return
        }
        req.headers.is_show_email = response.is_show_email
        req.headers.is_show_phone = response.is_show_phone

        req.headers.is_country_based_access_control_enabled = response.is_country_based_access_control_enabled
        req.headers.allowed_countries = response.allowed_countries
        req.headers.is_city_based_access_control_enabled = response.is_city_based_access_control_enabled
        req.headers.allowed_cities = response.allowed_cities
        req.headers.countries = response.countries
        req.headers.cities = response.cities
        req.headers.username = response.username

        next()
    } else {
        next()
    }
}
// admin panel router
router.use('/admin', middlewares, require('./admin/index'))

//partner router
router.use('/partner', middlewares, require('./partner/index'))

// Dispatcher Router
router.use('/dispatcher', middlewares, require('./dispatcher/index'))

//corporate router
router.use('/corporate',middlewares,require('./corporate/index'))

// Hotel Router
router.use('/hotel', middlewares, require('./hotel/index'))

// Hub Router
router.use('/hub', middlewares, require('./hub/index'))

module.exports = router