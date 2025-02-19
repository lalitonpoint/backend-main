let router = require('express').Router()
let promo_code = require('../controller/promo_code')

//for promo code
router.route('/fetch_promo_list').post(promo_code.fetch_promo_list)
router.route("/add_promo").post(promo_code.add_promo)
router.route('/delete_promocode').post(promo_code.delete_promocode)
router.route("/promo_used_info").post(promo_code.promo_used_info)
router.route('/update_promo_details').post(promo_code.update_promo_details)

// for banner
router.post('/get_banner_list', promo_code.get_banner_list);
router.post('/add_banner', promo_code.add_banner);
router.post('/update_banner', promo_code.update_banner);
router.post('/delete_banner', promo_code.delete_banner);

module.exports = router