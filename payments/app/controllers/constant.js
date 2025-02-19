const PAYMENT_GATEWAY = {
    stripe: 10,
    paystack: 11,
    payu: 12,
    paytabs: 13,
    paypal: 14,
    razorpay: 15
};
const IS_ADD_CARD = {
    10: true,
    11: true,
    12: false,
    13: true,
    14: false,
    15: false
}
const PAYMENT_STATUS = {
    WAITING: 0,
    COMPLETED: 1,
    FAILED: 2
}

const ERROR_CODE = {
    INVALID_SERVER_TOKEN: 4002,
};

const PROVIDER_TYPE = {
    NORMAL: 0,
    PARTNER: 1,
    ADMIN: 2
}

module.exports = {
    PAYMENT_GATEWAY,
    IS_ADD_CARD,
    PAYMENT_STATUS,
    ERROR_CODE,
    PROVIDER_TYPE
}