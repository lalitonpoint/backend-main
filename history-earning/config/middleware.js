
const CryptoJS = require('crypto-js');
let config = require('./config');

// Encryption key and algorithm
const secretKey = config.encyptionSecretKey; // Replace this with a strong key

exports.encryptResponse = function (req, res, next) {
    // Save the reference to the original send method of the response
    const originalSend = res.send;

    // Override the send method
    res.send = function (body) {
        if (!req.headers.encryption) {
            return originalSend.call(this, body);
        }

        // Encrypt the response data
        if (typeof body === 'string') {
            const encryptedData = CryptoJS.AES.encrypt(body, secretKey).toString();
            body = encryptedData
        } else if (typeof body === 'object') {
            const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(body), secretKey).toString();
            body = {encryptedData}
        }

        // Call the original send method with the modified body
        originalSend.call(this, body);
    };

    // Move to the next middleware
    next();
};

exports.decryptRequest = function (req, res, next) {
    // Save the reference to the original data method of the request
    // const originalData = req.body;

    // If the request body is encrypted, decrypt it
    if (req.body.encryptedData) {
        const bytes = CryptoJS.AES.decrypt(req.body.encryptedData, secretKey);
        const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        try {
            req.body = JSON.parse(decryptedData);
        } catch (error) {
            req.body = decryptedData; // Set decrypted data as req.body
        }
    }

    // Move to the next middleware
    next();
};

exports.decryptData = function (encryptedData) {
    const bytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
    const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    return decryptedData;
}