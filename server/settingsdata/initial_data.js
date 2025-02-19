process.env.NODE_ENV = process.env.NODE_ENV || 'development';
let mongoose = require('mongoose');
mongoose = require('../config/mongoose')
db = mongoose()

let Settings = require('mongoose').model('Settings');
let settingdata = require('./settings.json')

Settings.findOne().then(setting => {
    if (!setting) {
        let settings = new Settings(settingdata)
        settings.save()
    }
})

let SmsDetail = require('mongoose').model('sms_detail');
let smsdata = require('./sms.json')

SmsDetail.findOne().then(smsdetail => {
    if (!smsdetail) {
        SmsDetail.insertMany(smsdata, function (err, jellybean, snickers) { })
    }
})

let Email = require('mongoose').model('email_detail');
let emaildata = require('./email.json')

Email.findOne().then(emaildetail => {
    if (!emaildetail) {
        Email.insertMany(emaildata, function (err, jellybean, snickers) { })
    }
})

let Language = require('mongoose').model('language');
let languagedata = {
    name : "english",
    code : "en",
    string_file_path : "language/en.json",
    is_lang_rtl : false,
}

Language.findOne().then(languagedetail => {
    if (!languagedetail) {
        Language.create(languagedata, function (err, jellybean, snickers) { })
    }
})

setTimeout(() => {
    process.exit(0);
}, 5000);
