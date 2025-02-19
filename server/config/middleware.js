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

exports.modifyResponseMiddleware = (req, res, next) => {

    let Original_response = res.send;

    res.send = function (body) {
        try {
            // Check if response content type is JSON before attempting to parse
            const contentType = res.get('Content-Type');
            if (contentType && contentType.includes('application/json')) {
                // Try to parse the body if it's a string (potentially JSON that needs to be parsed)
                if (typeof body === 'string') {
                    try {
                        body = JSON.parse(body);  // Parse string into a JavaScript object
                    } catch (error) {
                        // If parsing fails, the body is probably plain text, so send it as is
                        return Original_response.call(this, body);
                    }
                }

                // Ensure the body is an object before modifying
                if (typeof body === 'object' && body !== null) {

                    // If it's a success response
                    if (body.success) {

                        if (body.message) {

                            let message_string;
                            if (req.headers.lang_code) {
                                try {
                                    let message_string_file = require(`../data/language/${req.headers.lang_code}.json`);
                                    message_string = message_string_file["success-code"][body.message] || "String Not Found";
                                } catch (error) {
                                    let message_string_file = require(`../data/language/en.json`);
                                    message_string = message_string_file["success-code"][body.message] || "String Not Found";
                                }
                            } else {
                                let message_string_file = require(`../data/language/en.json`);
                                message_string = message_string_file["success-code"][body.message] || "String Not Found";
                            }

                            body.success_code = String(body.message);
                            body.success_message = message_string || '';
                            delete body.message;
                        } else {
                            body.success_code = "1111"; //defult success code
                            body.success_message = "";
                        }
                    } else {
                        // For error response (success: false)
                        if (body.error_code) {
                            let error_string;
                            if (req.headers.lang_code) {
                                try {
                                    let message_string_file = require(`../data/language/${req.headers.lang_code}.json`);
                                    error_string = message_string_file["error-code"][body.error_code] || "String Not Found";
                                } catch (error) {
                                    let message_string_file = require(`../data/language/en.json`);
                                    error_string = message_string_file["error-code"][body.error_code] || "String Not Found";
                                }
                            } else {
                                let message_string_file = require(`../data/language/en.json`);
                                error_string = message_string_file["error-code"][body.error_code] || "String Not Found";
                            }

                            body.error_code = String(body.error_code);
                            body.error_message = body.error_message ? body.error_message : error_string || "";
                        } else {
                            body.error_code = "2222"; //defult error code
                            body.error_message = body.error_message || "";
                        }
                    }

                }

                // Call the original res.send with the modified or unmodified body
                Original_response.call(this, typeof body === 'object' ? JSON.stringify(body) : body);

            } else {
                // If it's not JSON content, send it as-is without modifying
                return Original_response.call(this, body);
            }

        } catch (error) {
            console.error('Error in modifyResponseMiddleware:', error);
            // If an error occurs, return the original response without modifications
            return Original_response.call(this, body);
        }
    };

    next();  // Continue to the next middleware or route handler
};


