const { Client, LocalAuth, MessageMedia, Location } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
let Settings = require('mongoose').model('Settings');
const messageQueue = [];
const fs = require('fs');

const wwebVersion = '2.2407.3';

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox']
    },
    webVersionCache: {
        type: "remote",
        remotePath:
          "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2411.2.html",
    },
    authTimeoutMs: 60000, // Optional: timeout for authentication in milliseconds
    qrTimeout: 30000, // Optional: timeout for QR code generation
});

// Refactor the event handlers to be more concise
client.on('loading_screen', async(percent, message) => {
    console.log('LOADING SCREEN', percent, message);
    await Settings.findOneAndUpdate({},{whatsapp_status: "LOADING SCREEN"}, { new: false });
});

client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcodeTerminal.generate(qr, { small: true }, async (qrcode) => {
        console.log(qrcode);
    });

    // Generate the QR code
    qrcode.toDataURL(qr, { errorCorrectionLevel: 'H' }, async(err, url) => {
        if (err) {
            console.log(err);
            return;
        }
        await Settings.findOneAndUpdate({},{whatsapp_qrcode: url, is_whatsapp_authenticated: false, whatsapp_status: "QR RECEIVED"}, { new: false });
    });
});

client.on('authenticated', async() => {
    console.log('AUTHENTICATED');
    await Settings.findOneAndUpdate({},{is_whatsapp_authenticated: true, whatsapp_status: "AUTHENTICATED"}, { new: true });
});

client.on('authStateChanged', (auth) => {
    console.log(auth);
    if (auth === 'logout') {
      console.log('Logged out successfully.');
    }
});

client.on('disconnected', async(reason) => {
    console.log(" **** disconnected");
    try {
        await client.destroy()
        // .then(async() => {
        //     await Settings.findOneAndUpdate({},{is_whatsapp_authenticated: false, whatsapp_status: "DISCONNECTED. "+reason}, { new: false });
        //     await client.initialize();
        // }, async (error) => {
        //     await client.initialize();
        // });
    } catch (error) {
        console.log(error);        
    }
    finally {
        await Settings.findOneAndUpdate({},{is_whatsapp_authenticated: false, whatsapp_status: "DISCONNECTED. "+reason}, { new: false });
        await client.initialize();
    }
});

client.on('auth_failure', async(msg) => {
    console.error('AUTHENTICATION FAILURE', msg);
    await Settings.findOneAndUpdate({},{is_whatsapp_authenticated: true, whatsapp_status: "AUTHENTICATION FAILURE", whatsapp_qrcode: ""}, { new: false });
});

client.on('ready', async () => {
    console.log('READY');
    await Settings.findOneAndUpdate({},{whatsapp_status: "READY"}, { new: true });

    try {
        //commented code sendQueuedMessages();
    } catch (error) {
        console.log(error);
    }
});

client.on('message', async msg => {
    if (msg.body === 'delete') {
        if (msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            if (quotedMsg.fromMe) {
                quotedMsg.delete(true);
            } else {
                msg.reply('I can only delete my own messages');
            }
        }
    }

    if (msg.body === 'resend' && msg.hasQuotedMsg) {
        const quotedMsg = await msg.getQuotedMessage();
        if (quotedMsg.hasMedia) {
            const attachmentData = await quotedMsg.downloadMedia();
            client.sendMessage(msg.from, attachmentData, { caption: 'Here\'s your requested media.' });
        }
        if (quotedMsg.hasMedia && quotedMsg.type === 'audio') {
            const audio = await quotedMsg.downloadMedia();
            await client.sendMessage(msg.from, audio, { sendAudioAsVoice: true });
        }
    } 
})

client.initialize();

exports.send_message = async function (req, res) {
    let country_phone_code = req.body?.country_phone_code ? req.body?.country_phone_code.replace(/^\+/, "") : ""
    let number = req.body?.number.replace(/^\+/, "")
    let content = req.body?.content

    let config = req.body?.config || null;
    
    let description = config?.description
    let messageType = config?.type
    let location = config?.location
    let url = config?.url


    if(await client.getState() == "CONNECTED"){
        switch (messageType) {
            case 'TEXT':
                sendMessage(country_phone_code, number, content);
                break;
            case 'LOCATION':
                sendLocation(country_phone_code, number, location, url);
                break;
            case 'FILE':
                sendFile(country_phone_code, number, config, req.files);
                break;
            default:
                sendMessage(country_phone_code, number, content);
                break;
        }
        res.json({success: true, success_code: "1111", success_message: ""})
    }else{
        messageQueue.push({
            country_phone_code, 
            number, 
            content, 
            messageType, 
            files: req.files, 
            description,
            latitude: req.body?.latitude,
            longitude: req.body?.longitude,
        });
        res.json({success: true, success_code: "1111", message: "Client not connected. Message is in queue"})
    }
}

exports.logout = async function (req, res) {
    console.log(" *** logout");
    try {
        await client.logout()
        res.json({success: true, success_code: "1111", success_message: ""})
        await client.destroy()
        //Commented Code; 
        // await client.destroy().then(async() => {
        //     await Settings.findOneAndUpdate({},{is_whatsapp_authenticated: false, whatsapp_status: "LOGGED OUT. "}, { new: false });
        //     await client.initialize();
        // }, async (error) => {
        //     await client.initialize();
        // });
    } catch (error) {
        res.json({success: false, error_code: "2222", error_message: "Logout Failed!"})
        console.log(error);        
    }finally {
        await Settings.findOneAndUpdate({},{is_whatsapp_authenticated: false, whatsapp_status: "LOGGED OUT"}, { new: false });
        await client.initialize();
    }
}

exports.delete_chat = function (req, res) {
    deleteChat(req.body.number)
    res.json({success: true})
}

// Helper function to format and send messages
function sendMessage(country_phone_code, number, message) {
    try {
        console.log(" *** sendMessage");
        number = number.includes('@c.us') ? number : `${number}@c.us`;
        number = country_phone_code + number;
        client.sendMessage(number, message)
    } catch (error) {
        console.log(error);
    }
}


function sendLocation(country_phone_code, number, location, url) {
    try {
        console.log(" *** sendMessage");
        number = number.includes('@c.us') ? number : `${number}@c.us`;
        number = country_phone_code + number;
        if(location?.length > 0){
            client.sendMessage(number, new Location(location[0], location[1], { url }))
        }
    } catch (error) {
        console.log(error);
    }
}


async function searchMessage(chatId, searchQuery){
    // Search for messages in the specified chat
    const messages = await client.searchMessages(searchQuery, {chatId}); //specific user
    // const messages = await client.searchMessages(searchQuery); // all chat
    console.log('Messages matching your search query:');
    messages.forEach((message) => {
        console.log(`Sender: ${message.from}`);
        console.log(`Message: ${message.body}`);
    });
}

async function deleteChat(number){
    try {
        (await client.getChatById(`${number}@c.us`)).delete()
    } catch (error) {
        console.log(error);        
    }
}

// Helper function to send files
function sendFile(country_phone_code, number, config, files) {
    try {
        number = number.includes('@c.us') ? number : `${number}@c.us`;
        number = country_phone_code + number;

        if(files){
            files?.forEach(file => {
                const media = MessageMedia.fromFilePath(file.path); // Use path.join for file path
                client.sendMessage(number, media, config.description?.length > 0 ? { caption: config.description } : {}).then((message)=>{
                });
                fs.unlink(file.path, (err) => {
                    if (err) {console.error(`Error deleting file: ${err}`);} 
                });
            });
        }

        if(config?.file){
            const media = new MessageMedia(config?.fileType, config?.file, config.fileName);
            client.sendMessage(number, media, { caption: config.description});
        }
        
    } catch (error) {
        console.log(error);
    }
}

function sendQueuedMessages() {
    messageQueue.forEach((message) => {
        switch (message.messageType) {
            case 'TEXT':
                sendMessage(message.country_phone_code, message.number, message.content);
                break;
            case 'LOCATION':
                sendLocation(message.country_phone_code, message.number, message.latitude, message.longitude);
                break;
            case 'FILE':
                sendFile(message.country_phone_code, message.number, message.files, message.description);
                break;
            default:
                break;
        }
    });
    messageQueue.length = 0;
}