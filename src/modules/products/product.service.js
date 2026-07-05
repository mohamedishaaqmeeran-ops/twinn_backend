const Product = require("../../models/Product");

exports.createProduct = async (userId, body) => {
  return Product.create({
    userId,
    ...body,
  });
};

exports.getProducts = async (userId) => {
  return Product.find({ userId }).sort({ createdAt: -1 });
};

exports.getProduct = async (id, userId) => {
  return Product.findOne({ _id: id, userId });
};

exports.updateProduct = async (id, userId, body) => {
  return Product.findOneAndUpdate(
    { _id: id, userId },
    body,
    { new: true, runValidators: true }
  );
};

exports.deleteProduct = async (id, userId) => {
  return Product.findOneAndDelete({ _id: id, userId });
};