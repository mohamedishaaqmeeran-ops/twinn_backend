const Product = require("../../models/Product");

exports.createProduct = async (userId, body) => {
  return await Product.create({
    userId,
    ...body,
  });
};

exports.getProducts = async (userId) => {
  return await Product.find({ userId }).sort({
    createdAt: -1,
  });
};

exports.getProduct = async (id, userId) => {
  return await Product.findOne({
    _id: id,
    userId,
  });
};

exports.updateProduct = async (id, userId, body) => {
  return await Product.findOneAndUpdate(
    {
      _id: id,
      userId,
    },
    body,
    {
      new: true,
    }
  );
};

exports.deleteProduct = async (id, userId) => {
  return await Product.findOneAndDelete({
    _id: id,
    userId,
  });
};