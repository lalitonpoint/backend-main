const mongoose = require('mongoose');
const incrementSchema = new mongoose.Schema({
  model: String,
  count: Number
});
const Increment = mongoose.model('Increment', incrementSchema);

exports.plugin = function(schema, options) {
  const model = options.model;
  let fields = {} // A hash of fields to add properties to in Mongoose.
  fields[options.field] = {
    type: Number,
    require: true
  };
  fields[options.field].unique = true;
  schema.add(fields);
  //Old Code: schema.add({ unique_id: Number });

  schema.pre('save', function (next) {
    const user = this;
    if (user.isNew) {
      Increment.findOneAndUpdate(
        { model: model },
        { $inc: { count: 1 } },
        { new: true, upsert: true }
      ).then((increment) => {

        user.unique_id = increment.count;
        next();
      });
    } else {
      next();
    }
  });
}

