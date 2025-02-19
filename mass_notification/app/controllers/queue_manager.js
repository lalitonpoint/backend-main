const Queue = require('bull');
let utils = require('./utils')

const massNotificationQueue = new Queue("massNotificationQueue", {
    redis: {
        port: 6379,
        host: "localhost",
    },
});

exports.init = function (err, res) {
    massNotificationQueue.process(async (job, done) => {
        console.log(`Job ${job.id} started`);
        const { user_type, deviceType, deviceTokens, message, webpush_config } = job.data;
        
        try {
            await utils.sendMassPushNotification(
                constant_json[user_type === 'user' ? 'USER_UNIQUE_NUMBER' : 'PROVIDER_UNIQUE_NUMBER'],
                deviceType,
                deviceTokens,
                message,
                constant_json.PUSH_NOTIFICATION_SOUND_FILE_IN_IOS,
                webpush_config
            );
            console.log(`Job ${job.id} is completed`);

        } catch (error) {
            console.error('Push notification error:', error);
        }

        done();
    });

    massNotificationQueue.on('progress', (job, progress) => {
        console.log(`Job ${job.id} is ${progress}% complete`);
    });
}

exports.massNotificationQueue = massNotificationQueue
