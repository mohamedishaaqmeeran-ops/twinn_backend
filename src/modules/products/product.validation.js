const Joi = require("joi");

exports.createProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),

  description: Joi.string().allow("").default(""),

  category: Joi.string().trim().max(100).allow("").default("General"),

  brand: Joi.string().trim().max(100).allow("").default(""),

  price: Joi.number().positive().required(),

  salePrice: Joi.number()
    .min(0)
    .max(Joi.ref("price"))
    .default(0),

  stock: Joi.number().integer().min(0).default(0),

  images: Joi.array()
    .items(Joi.string())
    .default([]),

  tags: Joi.array()
    .items(Joi.string().trim())
    .default([]),

  status: Joi.string()
    .valid("draft", "active", "inactive")
    .default("active"),

  isFeatured: Joi.boolean().default(false),

  // AI Twin
  script: Joi.string().allow("").default(""),

  offer: Joi.string().allow("").default(""),

  objectionHandling: Joi.string().allow("").default(""),

  // Analytics
  sales: Joi.number().integer().min(0).default(0),

  views: Joi.number().integer().min(0).default(0),

  rating: Joi.number().min(0).max(5).default(0),

  totalReviews: Joi.number().integer().min(0).default(0),
});

exports.updateProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150),

  description: Joi.string().allow(""),

  category: Joi.string().trim().max(100).allow(""),

  brand: Joi.string().trim().max(100).allow(""),

  price: Joi.number().positive(),

  salePrice: Joi.number()
    .min(0)
    .max(Joi.ref("price")),

  stock: Joi.number().integer().min(0),

  images: Joi.array().items(Joi.string()),

  tags: Joi.array().items(Joi.string().trim()),

  status: Joi.string().valid(
    "draft",
    "active",
    "inactive"
  ),

  isFeatured: Joi.boolean(),

  // AI Twin
  script: Joi.string().allow(""),

  offer: Joi.string().allow(""),

  objectionHandling: Joi.string().allow(""),

  // Analytics
  sales: Joi.number().integer().min(0),

  views: Joi.number().integer().min(0),

  rating: Joi.number().min(0).max(5),

  totalReviews: Joi.number().integer().min(0),
}).min(1);