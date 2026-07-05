const Twin = require("../../models/Twin");

exports.createTwin = async (userId, body) => {
  return Twin.create({
    userId,
    ...body,
  });
};

exports.getTwins = async (userId) => {
  return Twin.find({ userId }).sort({ createdAt: -1 });
};

exports.getTwin = async (id, userId) => {
  return Twin.findOne({ _id: id, userId });
};

exports.updateTwin = async (id, userId, body) => {
  return Twin.findOneAndUpdate(
    { _id: id, userId },
    body,
    { new: true, runValidators: true }
  );
};

exports.deleteTwin = async (id, userId) => {
  return Twin.findOneAndDelete({ _id: id, userId });
};