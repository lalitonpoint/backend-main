const fs = require('fs');
const path = require('path');
const request = require('request');

module.exports = {
    port: 5004,
    database_models: [
        "admin_settings",
    ],
    importMongooseModels: async function (models) {
        try {
            let Settings = require('mongoose').model('Settings');
            let setting = await Settings.findOne({},{api_base_url: 1})
            setTimeout(async() => {
                for await (const file_name of models) {
                    let filePath = path.join(__dirname, "../app/models/" + file_name + ".js");
                    let url = setting.api_base_url + "/admin/get_mongoose_models";
                    let data = {
                        fileName: file_name,
                    };
                    await new Promise((resolve, reject) => {
                        request.post(
                            {
                                url: url,
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify(data),
                            },
                            (error, response, body) => {
                                
                                if (error) {
                                    console.error(error);
                                    reject(error);
                                } else {
        
                                    if (fs.existsSync(filePath)) {
                                        const file1Content = fs.readFileSync(filePath, "utf8");
                                        if (file1Content === body) {
                                            resolve();
                                            return;
                                        }
                                    }
        
                                    // check if file is valid or not. This will check if file contains word 'new Schema'
                                    const regex = /new schema/gi;
                                    if (body.match(regex)) {
                                        // If file is valid then only it will create/modify
                                        fs.writeFile(filePath, body, "utf8", (err, result) => {
                                            if (err) {
                                                console.error("Error modifying file:", err);
                                                reject(err);
                                            } else {
                                                resolve(result);
                                                console.log(file_name + " file modified successfully.");
                                            }
                                        });
                                    } else{
                                        console.log("Invalid File");
                                    }
        
                                }
                            }
                        );
                    });
                }
            }, 3000);
        } catch (error) {
            console.error("Error fetching database model:", error);
        }
    }
}