let Trip = require('mongoose').model('Trip');
let Trip_history = require('mongoose').model('Trip_history');
let TripLocation = require('mongoose').model('trip_location');
let Reviews = require('mongoose').model('Reviews');
let User = require('mongoose').model('User');
let Provider = require('mongoose').model('Provider');
let Wallet_history = require('mongoose').model('Wallet_history');
let User_Document = require('mongoose').model('User_Document');
let Card = require('mongoose').model('Card');
let utils = require('./utils');
let Provider_daily_analytic = require('mongoose').model('provider_daily_analytic')
let Provider_Document = require('mongoose').model('Provider_Document');
let Provider_Vehicle_Document = require('mongoose').model('Provider_Vehicle_Document');
let Dispatcher = require('mongoose').model('Dispatcher');
let Partner = require('mongoose').model('Partner');
let Partner_Vehicle_Document = require('mongoose').model('Partner_Vehicle_Document');
let Corporate = require('mongoose').model('Corporate');
let mongoose = require('mongoose');
let Schema = mongoose.Types.ObjectId;
exports.deleteData = async function(beforeDate){
  await delete_all_general_data(beforeDate)
  await delete_trip_data(beforeDate)
  await delete_user_details(beforeDate)
  await delete_provider_details(beforeDate)
  await delete_dispatcher_details(beforeDate)
  await delete_partner_details(beforeDate)
  await delete_corporate_details(beforeDate)
}

async function delete_all_general_data(beforeDate){
  let date = new Date(beforeDate)
  console.log("Deleting all general data before : " + date);

   /////////////////////  ALL other details before date  /////////////////////

  // all reviews
  let reviews = await Reviews.deleteMany({created_at: {$lte: date}});
  console.log("trip reviews : ", reviews.deletedCount)
  
  // all cards
  let cards = await Card.deleteMany({created_at: {$lte: date}});
  console.log("all cards : ", cards.deletedCount)

  // all wallet history
  let wallet_history = await Wallet_history.deleteMany({created_at: {$lte: date}});
  console.log("all wallet_history : ", wallet_history.deletedCount)

  // all documents
  let all_documents = await User_Document.deleteMany({created_at: {$lte: date}});
  console.log("all_documents : ", all_documents.deletedCount)

  // all_provider_daily_analytic
  let all_provider_daily_analytic = await Provider_daily_analytic.deleteMany({created_at: {$lte: date}});
  console.log("all_provider_daily_analytic : ", all_provider_daily_analytic.deletedCount)
}

async function delete_trip_data(beforeDate){
  let date = new Date(beforeDate)
  console.log("Deleting trip data before : " + date);


  /////////////////////  TRIPS  /////////////////////

  let trips = await Trip.aggregate([{$match: {created_at: {$lte: date}}},{$group: {_id: null, ids: {$push: "$_id"}}}])
  let trip_ids = []
  if(trips.length > 0){
    trip_ids = trips[0].ids
  }
  console.log("trip_ids : ", trip_ids.length)
  delete_trip_details(trip_ids)

  /////////////////////  TRIP HISTORIES  /////////////////////

  let trip_histories = await Trip_history.aggregate([{$match: {created_at: {$lte: date}}},{$group: {_id: null, ids: {$push: "$_id"}}}])
  let trip_history_ids = []
  if(trip_histories.length > 0){
    trip_history_ids = trip_histories[0].ids
  }
  console.log("trip_history_ids : ", trip_history_ids.length)
  delete_trip_details(trip_history_ids)

}

async function delete_trip_details(trip_ids){

  // trip_location
  let trip_location = await TripLocation.deleteMany({tripID: {$in: trip_ids}});
  console.log("trip_location : ", trip_location.deletedCount)

  // user trip reviews
  let trip_reviews = await Reviews.deleteMany({trip_id: {$in: trip_ids}});
  console.log("Trip reviews : ", trip_reviews.deletedCount)

  let trip_delete = await Trip_history.deleteMany({_id: {$in: trip_ids}});
  console.log("Trip deleted : ", trip_delete.deletedCount)

  let trips = await Trip.deleteMany({_id: {$in: trip_ids}});
  console.log("Trips deleted : ", trips.deletedCount)

  let trip_histories = await Trip_history.deleteMany({_id: {$in: trip_ids}});
  console.log("Trips deleted : ", trip_histories.deletedCount)

}

async function delete_user_details(beforeDate){
  let date = new Date(beforeDate)
  console.log("Deleting user data before : " + date);
  /////////////////////  USER  /////////////////////

  // delete user profile image
  let user_profile = []
  let user_profiles = await User.aggregate([{$match: {created_at: {$lte: date}}}, {$match: { picture: {$ne: ""} }},{$group: {_id: null, user_profile: {$push: "$picture"}}}])
  if(user_profiles.length > 0){
    user_profile = user_profiles[0].user_profile
  }
  console.log(user_profile)
  user_profile.forEach(element => {
    utils.deleteImageFromFolder(element, 1);
  });

  // Users
  let users = await User.aggregate([{$match: {created_at: {$lte: date}}}, {$match: { current_trip_id: null }},{$group: {_id: null, ids: {$push: "$_id"}}}])
  let user_ids = []
  if(users.length > 0){
    user_ids = users[0].ids
  }
  console.log("user_ids : ", user_ids.length)

  // user wallet history
  let user_wallet_history = await Wallet_history.deleteMany({user_id: {$in: user_ids}});
  console.log("user wallet_history : ", user_wallet_history.deletedCount)

  // user documents
  let user_document = await User_Document.deleteMany({user_id: {$in: user_ids}});
  console.log("user_document : ", user_document.deletedCount)

  // user trips
  let user_trip_histories = await Trip_history.aggregate([{$match: {user_id: {$in: user_ids}}},{$group: {_id: null, ids: {$push: "$_id"}}}])
  let user_trip_ids = []
  if(user_trip_histories.length > 0){
    user_trip_ids = user_trip_histories[0].ids
  }
  console.log("User trips : ", user_trip_ids.length)

  // user trip_location
  let user_trip_location = await TripLocation.deleteMany({tripID: {$in: user_trip_ids}});
  console.log("user_trip_location : ", user_trip_location.deletedCount)

  // user trip reviews
  let user_reviews = await Reviews.deleteMany({trip_id: {$in: user_trip_ids}});
  console.log("User trip reviews : ", user_reviews.deletedCount)

  // user cards
  let user_cards = await Card.deleteMany({user_id: {$in: user_ids}});
  console.log("User cards : ", user_cards.deletedCount)

  // users
  let user_deleted = await User.deleteMany({_id: {$in: user_ids}});
  console.log("Users : ", user_deleted.deletedCount)

  // annonymous user
  let user_detail = await User.findOne({ phone: '0000000000' });
  if (!user_detail) {
      user_detail = new User({
          _id: Schema('000000000000000000000000'),
          first_name: 'anonymous',
          last_name: 'user',
          email: 'anonymoususer@gmail.com',
          phone: '0000000000',
          country_phone_code: '',
      })
      await user_detail.save();
  }

  // running trip users
  let running_trip_users = await User.aggregate([{$match: {created_at: {$lte: date}}}, {$match: { current_trip_id: {$ne: null} }},{$group: {_id: null, ids: {$push: "$_id"}}}])
  let running_trip_user_ids = []
  if(running_trip_users.length > 0){
    running_trip_user_ids = running_trip_users[0].ids
  }
  console.log(running_trip_user_ids);

  let deleted_running_trips = await Trip.deleteMany({ is_schedule_trip: true, user_id: {$in: running_trip_user_ids} })
  console.log("User deleted_running_trips : ", deleted_running_trips.deletedCount)

  let updated_running_trips = await Trip.updateMany({ user_id: {$in: running_trip_user_ids} }, { user_id: user_detail._id });
  console.log("User updated_running_trips : ", updated_running_trips.modifiedCount)

  // running trip users
  let running_trip_user_deleted = await User.deleteMany({_id: {$in: running_trip_user_ids}});
  console.log("Running Trip Users : ", running_trip_user_deleted.deletedCount)
  
}

async function delete_provider_details(beforeDate){
  let date = new Date(beforeDate)
  console.log("Deleting provider data before : " + date);
  /////////////////////  PROVIDER  /////////////////////
  
  
  let providers = await Provider.aggregate([{$match: {created_at: {$lte: date}}}, {$match: { provider_type_id: null }},{$group: {_id: null, ids: {$push: "$_id"}}}])
  let provider_ids = []
  if(providers.length > 0){
    provider_ids = providers[0].ids
  }
  console.log("provider_ids : ", provider_ids.length)

  delete_provider_with_ids(provider_ids)
}

async function delete_provider_with_ids(provider_ids){
 
  // delete user profile image
  let provider_profile = []
  let provider_profiles = await Provider.aggregate([{$match: {_id: {$in: provider_ids}}}, {$match: { picture: {$ne: ""} }},{$group: {_id: null, provider_profile: {$push: "$picture"}}}])
  if(provider_profiles.length > 0){
    provider_profile = provider_profiles[0].provider_profile
  }
  console.log(provider_profile)
  provider_profile.forEach(element => {
    utils.deleteImageFromFolder(element, 2);
  });
  
  // provider wallet history
  let provider_wallet_history = await Wallet_history.deleteMany({user_id: {$in: provider_ids}});
  console.log("provider_wallet_history : ", provider_wallet_history.deletedCount)

  // provider_document
  let provider_document = await Provider_Document.deleteMany({provider_id: {$in: provider_ids}});
  console.log("provider_document : ", provider_document.deletedCount)

  // vehicle documents
  let provider_vehicle_document = await Provider_Vehicle_Document.deleteMany({provider_id: {$in: provider_ids}});
  console.log("provider_vehicle_document : ", provider_vehicle_document.deletedCount)

  // provider cards
  let provider_cards = await Card.deleteMany({user_id: {$in: provider_ids}});
  console.log("Provider cards : ", provider_cards.deletedCount)

  // updateMany
  let trip_histories = await Trip_history.deleteMany({ confirmed_provider: { $in: provider_ids } });
  let trips = await Trip.deleteMany({ confirmed_provider: { $in: provider_ids } });
  let wallet_history = await Wallet_history.deleteMany({ user_id: { $in: provider_ids } });
  let providers_delete = await Provider.deleteMany({ _id: { $in: provider_ids } });

  console.log("Provider trip_histories : ", trip_histories.deletedCount)
  console.log("Provider trips : ", trips.deletedCount)
  console.log("Provider wallet_history : ", wallet_history.deletedCount)
  console.log("Providers : ", providers_delete.deletedCount)


}

async function delete_dispatcher_details(beforeDate){
  let date = new Date(beforeDate)
  console.log("Deleting dispatcher data before : " + date);
  /////////////////////  PROVIDER  /////////////////////
  // Dispatcher
  let dispatchers = await Dispatcher.deleteMany({created_at: {$lte: date}});
  console.log("dispatchers : ", dispatchers.deletedCount)

}

async function delete_partner_details(beforeDate){
  let date = new Date(beforeDate)
  console.log("Deleting partner data before : " + date);
  /////////////////////  PARTNER  /////////////////////
  // Partner
  let partners = await Partner.aggregate([{$match: {created_at: {$lte: date}}}, {$group: {_id: null, ids: {$push: "$_id"}}}])
  let partner_ids = []
  if(partners.length > 0){
    partner_ids = partners[0].ids
  }
  console.log("partner_ids : ", partner_ids.length)

  //////////////// partner trips ////////////////
  console.log("//////////////// partner trips ////////////////");


  // partner trips
  let partner_trip_histories = await Trip_history.aggregate([{$match: {user_id: {$in: partner_ids}}},{$group: {_id: null, ids: {$push: "$_id"}}}])
  let partner_trip_ids = []
  if(partner_trip_histories.length > 0){
    partner_trip_ids = partner_trip_histories[0].ids
  }
  console.log("Partner trips : ", partner_trip_ids.length)

  // partner trip_location
  let partner_trip_location = await TripLocation.deleteMany({tripID: {$in: partner_trip_ids}});
  console.log("partner_trip_location : ", partner_trip_location.deletedCount)

  // partner trip reviews
  let partner_reviews = await Reviews.deleteMany({trip_id: {$in: partner_trip_ids}});
  console.log("Partner trip reviews : ", partner_reviews.deletedCount)

  // partner cards
  let partner_cards = await Card.deleteMany({user_id: {$in: partner_ids}});
  console.log("Partner cards : ", partner_cards.deletedCount)

  // partner vehicle documents
  let partner_vehicle_documents = await Partner_Vehicle_Document.deleteMany({partner_id: {$in: partner_ids}});
  console.log("Partner vehicle documents : ", partner_vehicle_documents.deletedCount)

  //////////////// partner providers ////////////////
  console.log("//////////////// partner providers ////////////////");

  let providers = await Provider.aggregate([{$match: { provider_type_id: {$in: partner_ids} }},{$group: {_id: null, ids: {$push: "$_id"}}}])
  let provider_ids = []
  if(providers.length > 0){
    provider_ids = providers[0].ids
  }
  console.log("partner provider_ids : ", provider_ids.length)


  // partner
  let partner_deleted = await Partner.deleteMany({_id: {$in: partner_ids}});
  console.log("Partners : ", partner_deleted.deletedCount)

  delete_provider_with_ids(provider_ids)

}

async function delete_corporate_details(beforeDate){
  let date = new Date(beforeDate)
  console.log("Deleting corporate data before : " + date);
  /////////////////////  CORPORATE  /////////////////////
  // Corporates
  let corporates = await Corporate.aggregate([{$match: {created_at: {$lte: date}}}, {$group: {_id: null, ids: {$push: "$_id"}}}])
  let corporate_ids = []
  if(corporates.length > 0){
    corporate_ids = corporates[0].ids
  }
  console.log("corporate_ids : ", corporate_ids.length)


  let trip_histories = await Trip_history.aggregate([{$match: {user_type_id: {$in: corporate_ids}}},{$group: {_id: null, ids: {$push: "$_id"}}}])
  let trip_ids = []
  if(trip_histories.length > 0){
    trip_ids = trip_histories[0].ids
  }
  console.log("trip_ids : ", trip_ids.length)

  // trip_location
  let trip_location = await TripLocation.deleteMany({tripID: {$in: trip_ids}});
  console.log("trip_location : ", trip_location.deletedCount)

   // user trip reviews
   let trip_reviews = await Reviews.deleteMany({trip_id: {$in: trip_ids}});
   console.log("Trip reviews : ", trip_reviews.deletedCount)

  // Update corporate users to normal users
  let corporate_users = await User.updateMany({ user_type_id: { $in: corporate_ids } }, { user_type_id: null, corporate_ids: [], user_type: constant_json.USER_TYPE_NORMAL });
  console.log("corporate_users updated: ", corporate_users.modifiedCount)

    
  // corporate wallet history
  let corporate_wallet_history = await Wallet_history.deleteMany({user_id: {$in: corporate_ids}});
  console.log("corporate_wallet_history : ", corporate_wallet_history.deletedCount)


  // corporate cards
  let corporate_cards = await Card.deleteMany({user_id: {$in: corporate_ids}});
  console.log("Corporate cards : ", corporate_cards.deletedCount)

  let corporates_delete = await Corporate.deleteMany({_id: {$in: corporate_ids}});
  console.log("Corporates deleted : ", corporates_delete.deletedCount)


}