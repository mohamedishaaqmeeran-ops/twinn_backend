const productService = require("./product.service");

const {
  createProductSchema,
  updateProductSchema,
} = require("./product.validation");

exports.create = async (req, res) => {
  try {
    const imageUrls = req.files?.map((file) => file.path) || [];

    const body = {
      ...req.body,
      price: Number(req.body.price),
      salePrice: Number(req.body.salePrice || 0),
      stock: Number(req.body.stock || 0),
      images: imageUrls,
    };

    const { error, value } = createProductSchema.validate(body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details.map((item) => item.message).join(", "),
      });
    }

    const product = await productService.createProduct(req.user.id, value);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.list = async (req, res) => {
  try {
    const products = await productService.getProducts(req.user.id);

    res.status(200).json({
      success: true,
      products,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.single = async (req, res) => {
  try {
    const product = await productService.getProduct(
      req.params.id,
      req.user.id
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.update = async (req, res) => {
  try {
    const imageUrls = req.files?.map((file) => file.path) || [];

    const body = {
      ...req.body,
      ...(req.body.price !== undefined && { price: Number(req.body.price) }),
      ...(req.body.salePrice !== undefined && {
        salePrice: Number(req.body.salePrice || 0),
      }),
      ...(req.body.stock !== undefined && { stock: Number(req.body.stock || 0) }),
      ...(imageUrls.length > 0 && { images: imageUrls }),
    };

    const { error, value } = updateProductSchema.validate(body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details.map((e) => e.message).join(", "),
      });
    }

    const product = await productService.updateProduct(
      req.params.id,
      req.user.id,
      value
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.remove = async (req, res) => {
  try {
    const product = await productService.deleteProduct(
      req.params.id,
      req.user.id
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};