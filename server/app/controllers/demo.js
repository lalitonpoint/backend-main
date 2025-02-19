let utils = require('../controllers/utils');
let crypto = require('crypto');
let Corporate = require('mongoose').model('Corporate');
let Dispatcher = require('mongoose').model('Dispatcher');
let Hotel = require('mongoose').model('Hotel');
let Partner = require('mongoose').model('Partner');
let Country = require('mongoose').model('Country');
let Citytype = require('mongoose').model('city_type');
let Type = require('mongoose').model('Type');
let Trip_Service = require('mongoose').model('trip_service');
let City = require('mongoose').model('City');
const geolib = require('geolib');

exports.add_detail = function (req, res) {

    let token = utils.tokenGenerator(32);
    let password = req.body.password;
    let hash = crypto.createHash('md5').update(password).digest('hex');
    let json = {
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        email: ((req.body.email).trim()).toLowerCase(),
        country_phone_code: req.body.country_phone_code,
        phone: req.body.phone,
        password: hash,
        country: req.body.country,
        country_name: req.body.country,
        country_id: req.body.country_id,
        city_id: req.body.city_id,
        city: req.body.city,
        token: token,
        is_approved: 1
    }
    Corporate.findOne({$or: [{email: ((req.body.email).trim()).toLowerCase()}, {phone: req.body.phone}]}).then((response) => { 

        if(!response){
            json.name = json.first_name + json.last_name
            let corporate_detail = new Corporate(json);
            corporate_detail.save();
        }

    });

    Dispatcher.findOne({$or: [{email: ((req.body.email).trim()).toLowerCase()}, {phone: req.body.phone}]}).then((response) => { 

        if(!response){
            Dispatcher.count({}).then((dispatcher_count)=>{
                const dispatcherJson = { ...json }
                dispatcherJson.countryid = json.country_id
                delete dispatcherJson.country_id

                dispatcherJson.unique_id = dispatcher_count + 1;
                let dispatcher_detail = new Dispatcher(dispatcherJson);
                dispatcher_detail.save();
            })
        }

    });

    Partner.findOne({$or: [{email: ((req.body.email).trim()).toLowerCase()}, {phone: req.body.phone}]}).then((response) => { 

        if(!response){
            Partner.count({}).then((partner_count)=>{
                json.unique_id = partner_count+1;
                let partner_detail = new Partner(json);
                partner_detail.save();
            })
        }

    });

    Hotel.findOne({$or: [{email: ((req.body.email).trim()).toLowerCase()}, {phone: req.body.phone}]}).then((response) => { 

        if(!response){
            Hotel.count({}).then((hotel_count)=>{
                const hotelJson = { ...json }
                hotelJson.countryid = json.country_id
                delete hotelJson.country_id

                hotelJson.unique_id = hotel_count + 1;
                hotelJson.hotel_name = req.body.first_name;
                let hotel_detail = new Hotel(hotelJson);
                hotel_detail.save();
            })
        }

    });

    setTimeout(()=>{
        res.json({success: true})
    }, 2000)

}

exports.check_service_type = function (request_data, response_data) {
    let request_data_body = request_data.body;

    Citytype.findOne({cityid: request_data_body.cityid, typeid: request_data_body.typeid}).then((citytype_data) => {
        if(!citytype_data){

            Country.findOne({_id: request_data_body.countryid}).then((country_data) => {
                let citytype_data = new Citytype({
                    countryid: request_data_body.countryid,
                    countryname: country_data.countryname,
                    cityname: request_data_body.cityname,
                    cityid: request_data_body.cityid,
                    typeid: request_data_body.typeid,
                    min_fare: 30,
                    surge_hours:[
                        {
                            "is_surge": false,
                            "day": "0",
                            "day_time": []
                        },
                        {
                            "is_surge": false,
                            "day": "1",
                            "day_time": []
                        },
                        {
                            "is_surge": false,
                            "day": "2",
                            "day_time": []
                        },
                        {
                            "is_surge": false,
                            "day": "3",
                            "day_time": []
                        },
                        {
                            "is_surge": false,
                            "day": "4",
                            "day_time": []
                        },
                        {
                            "is_surge": false,
                            "day": "5",
                            "day_time": []
                        },
                        {
                            "is_surge": false,
                            "day": "6",
                            "day_time": []
                        }
                    ]
                });

                citytype_data.save(() => {
                    Type.findOne({ _id: citytype_data.typeid }).then((type_detail) => {
                        let trip_service = new Trip_Service({
                            service_type_id: citytype_data._id,
                            city_id: citytype_data.cityid,
                            service_type_name: (type_detail.typename).trim(),
                            min_fare: citytype_data.min_fare,
                            typename: (type_detail.typename).trim(),
                            surge_hours:[
                                {
                                    "is_surge": false,
                                    "day": "0",
                                    "day_time": []
                                },
                                {
                                    "is_surge": false,
                                    "day": "1",
                                    "day_time": []
                                },
                                {
                                    "is_surge": false,
                                    "day": "2",
                                    "day_time": []
                                },
                                {
                                    "is_surge": false,
                                    "day": "3",
                                    "day_time": []
                                },
                                {
                                    "is_surge": false,
                                    "day": "4",
                                    "day_time": []
                                },
                                {
                                    "is_surge": false,
                                    "day": "5",
                                    "day_time": []
                                },
                                {
                                    "is_surge": false,
                                    "day": "6",
                                    "day_time": []
                                }
                            ]
                        });
                        trip_service.save().then(() => {
                            response_data.json({ success: true, service_type: citytype_data._id });
                        });
                    })
                })
            });
        } else {
            response_data.json({
                success: true, service_type: citytype_data._id
            });
        }
    });
}

exports.get_country_list = function (req, res) {
    let country_list = require('../../country_list.json');
    res.json(country_list);
};

exports.type_list = function (req, res) {
    Type.find({is_business:1}).then((type_list) => { 
        res.json({'type_list': type_list});
    });
    
};

exports.fetch_country_detail = function (req, res) {
    let country_list = require('../../country_list.json');
    let countryname = req.body.countryname;
    let i = country_list.findIndex(i => i.name == countryname);
    let country = {}
    if (i != -1) {
        country = country_list[i]
    }
    res.json({ country });
};

exports.check_country_exists = function (request_data, response_data) {
    Country.find({countryphonecode: request_data.body.country_phone_code ,countrycode:request_data.body.countrycode }).then(country => {
        console.log(country)
        if(country.length > 0){
            response_data.json({ success: true, country_id: country[0]._id, country_code: country[0].countrycode, message: 'country already exists' })
        } else {
            console.log(request_data_body)
            let request_data_body = request_data.body;
            request_data.countryname = request_data.body.countryname.replace(/'/g, '');
            request_data_body.countryphonecode = request_data.body.country_phone_code;
            let add_country = new Country(request_data_body);
            let file_new_name = (add_country.countryname).split(' ').join('_').toLowerCase() + '.gif';
            let file_upload_path = '/flags/' + file_new_name;
            add_country.flag_url = file_upload_path;
            add_country.save().then((country) => {
                response_data.json({
                    success: true,
                    country_id: country._id,
                    country_code: country.countrycode
                });
            }, (error) => {
                console.log(error);
                response_data.json({
                    success: false
                });
            });
        }
    })
}

exports.check_city = async function (request_data, response_data) {
    try {
        let request_data_body = request_data.body
        const cities = await City.find({ countryid: request_data_body.countryid }).sort({ isBusiness: -1 })

        let city_exists = false
        let existing_city

        for await (const city_detail of cities) {
            if (city_detail.is_use_city_boundary && city_detail.city_locations.length) {
                const saved_city = geolib.isPointInside(
                    {
                        latitude: Number(request_data_body.city_lat),
                        longitude: Number(request_data_body.city_lng),
                    },
                    city_detail.city_locations
                )

                if (saved_city) {
                    existing_city = city_detail
                    city_exists = true
                    break
                }
            } else if (!city_detail.is_use_city_boundary && city_detail.cityRadius) {
                const distance = geolib.getDistance(
                    { latitude: Number(request_data_body.city_lat), longitude: Number(request_data_body.city_lng) },
                    { latitude: city_detail.cityLatLong[0], longitude: city_detail.cityLatLong[1] }
                );

                if ((distance / 1000) <= city_detail.cityRadius) {
                    existing_city = city_detail
                    city_exists = true
                    break
                }
            }
        }

        if (!city_exists) {
            let cityname = (request_data_body.cityname).trim();
            cityname = cityname.charAt(0).toUpperCase() + cityname.slice(1);
            request_data_body.cityname = cityname;
            request_data_body.cityRadius = 20
            request_data_body.cityLatLong = [request_data_body.city_lat, request_data_body.city_lng];

            const city = new City(request_data_body);
            city.save().then(() => {
                response_data.json({ success: true, city_id: city._id, cityname: city.cityname });
            }, (error) => {
                console.log(error)
                response_data.json({ success: false });
            });
        } else {
            if (existing_city.isBusiness == 0) {
                await City.findByIdAndUpdate(existing_city._id, { isBusiness: 1 })
            }
            response_data.json({ success: false, city_id: existing_city._id,  cityname: existing_city.cityname })
        }
    } catch (error) {
        console.log(error)
        response_data.json({ success: false });
    }
}