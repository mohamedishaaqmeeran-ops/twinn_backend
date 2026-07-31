const Joi =
  require("joi");

/* =========================================================
   CONSTANTS
========================================================= */

const PRODUCT_STATUSES = [
  "draft",
  "active",
  "inactive",
  "archived",
];

const TRAINING_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
];

const CURRENCY_PATTERN =
  /^[A-Z]{3}$/;

const OBJECT_ID_PATTERN =
  /^[0-9a-fA-F]{24}$/;

const HTTP_URL_PATTERN =
  /^https?:\/\/.+/i;

/* =========================================================
   REUSABLE SCHEMAS
========================================================= */

const objectIdSchema =
  Joi.string()
    .trim()
    .pattern(
      OBJECT_ID_PATTERN
    )
    .messages({
      "string.pattern.base":
        "{{#label}} must be a valid MongoDB ObjectId",
    });

const optionalObjectIdSchema =
  objectIdSchema
    .allow(
      null,
      ""
    )
    .empty("");

const textItemSchema =
  Joi.string()
    .trim()
    .min(1)
    .max(500);

const keywordSchema =
  Joi.string()
    .trim()
    .lowercase()
    .min(1)
    .max(100);

const imageSchema =
  Joi.string()
    .trim()
    .max(2048)
    .custom(
      (
        value,
        helpers
      ) => {
        /*
         Accept:
         - Cloudinary URLs
         - S3/GCS URLs
         - Local uploaded paths
         - Relative public paths
        */

        if (
          HTTP_URL_PATTERN.test(
            value
          )
        ) {
          return value;
        }

        if (
          value.startsWith(
            "/"
          ) ||
          value.startsWith(
            "uploads/"
          ) ||
          value.startsWith(
            "products/"
          )
        ) {
          return value;
        }

        return helpers.error(
          "string.invalidImage"
        );
      }
    )
    .messages({
      "string.invalidImage":
        "{{#label}} must be a valid image URL or uploaded file path",
    });

const specificationsSchema =
  Joi.object()
    .pattern(
      Joi.string()
        .trim()
        .min(1)
        .max(100),

      Joi.alternatives()
        .try(
          Joi.string()
            .trim()
            .max(500),

          Joi.number(),

          Joi.boolean()
        )
        .custom(
          (
            value
          ) =>
            String(value)
        )
    )
    .max(100);

const currencySchema =
  Joi.string()
    .trim()
    .uppercase()
    .length(3)
    .pattern(
      CURRENCY_PATTERN
    )
    .messages({
      "string.length":
        "Currency must be a three-letter ISO currency code",

      "string.pattern.base":
        "Currency must contain only uppercase letters",
    });

/* =========================================================
   CREATE PRODUCT SCHEMA
========================================================= */

exports.createProductSchema =
  Joi.object({
    twinId:
      optionalObjectIdSchema
        .default(null),

    name:
      Joi.string()
        .trim()
        .min(2)
        .max(150)
        .required(),

    slug:
      Joi.string()
        .trim()
        .lowercase()
        .max(180)
        .pattern(
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/
        )
        .optional(),

    description:
      Joi.string()
        .trim()
        .min(1)
        .max(5000)
        .required(),

    shortDescription:
      Joi.string()
        .trim()
        .allow("")
        .max(300)
        .default(""),

    category:
      Joi.string()
        .trim()
        .max(100)
        .allow("")
        .empty("")
        .default(
          "General"
        ),

    brand:
      Joi.string()
        .trim()
        .max(100)
        .allow("")
        .default(""),

    sku:
      Joi.string()
        .trim()
        .uppercase()
        .max(100)
        .allow("")
        .empty("")
        .optional(),

    price:
      Joi.number()
        .precision(2)
        .min(0)
        .required(),

    compareAtPrice:
      Joi.number()
        .precision(2)
        .min(0)
        .allow(null)
        .default(null),

    currency:
      currencySchema
        .default("INR"),

    stock:
      Joi.number()
        .integer()
        .min(0)
        .default(0),

    trackInventory:
      Joi.boolean()
        .default(true),

    allowBackorder:
      Joi.boolean()
        .default(false),

    thumbnail:
      imageSchema
        .allow("")
        .default(""),

    image:
      imageSchema
        .allow("")
        .default(""),

    images:
      Joi.array()
        .items(
          imageSchema
        )
        .max(5)
        .unique()
        .default([]),

    video:
      Joi.string()
        .trim()
        .uri({
          scheme: [
            "http",
            "https",
          ],
        })
        .max(2048)
        .allow("")
        .default(""),

    features:
      Joi.array()
        .items(
          textItemSchema
        )
        .max(50)
        .unique()
        .default([]),

    benefits:
      Joi.array()
        .items(
          textItemSchema
        )
        .max(50)
        .unique()
        .default([]),

    specifications:
      specificationsSchema
        .default({}),

    shippingInformation:
      Joi.string()
        .trim()
        .allow("")
        .max(2000)
        .default(""),

    returnPolicy:
      Joi.string()
        .trim()
        .allow("")
        .max(2000)
        .default(""),

    warranty:
      Joi.string()
        .trim()
        .allow("")
        .max(1000)
        .default(""),

    aiKeywords:
      Joi.array()
        .items(
          keywordSchema
        )
        .max(100)
        .unique()
        .default([]),

    liveEnabled:
      Joi.boolean()
        .default(true),

    featured:
      Joi.boolean()
        .default(false),

    status:
      Joi.string()
        .trim()
        .lowercase()
        .valid(
          ...PRODUCT_STATUSES.filter(
            (status) =>
              status !==
              "archived"
          )
        )
        .default(
          "draft"
        ),
  })
    .custom(
      (
        value,
        helpers
      ) => {
        if (
          value.compareAtPrice !==
            null &&
          value.compareAtPrice !==
            undefined &&
          value.compareAtPrice <
            value.price
        ) {
          return helpers.error(
            "product.compareAtPrice"
          );
        }

        return value;
      }
    )
    .messages({
      "product.compareAtPrice":
        "Compare-at price must be greater than or equal to the product price",
    });

/* =========================================================
   UPDATE PRODUCT SCHEMA
========================================================= */

exports.updateProductSchema =
  Joi.object({
    twinId:
      optionalObjectIdSchema,

    name:
      Joi.string()
        .trim()
        .min(2)
        .max(150),

    slug:
      Joi.string()
        .trim()
        .lowercase()
        .max(180)
        .pattern(
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/
        ),

    description:
      Joi.string()
        .trim()
        .min(1)
        .max(5000),

    shortDescription:
      Joi.string()
        .trim()
        .allow("")
        .max(300),

    category:
      Joi.string()
        .trim()
        .max(100)
        .allow(""),

    brand:
      Joi.string()
        .trim()
        .max(100)
        .allow(""),

    sku:
      Joi.string()
        .trim()
        .uppercase()
        .max(100)
        .allow("")
        .empty(""),

    price:
      Joi.number()
        .precision(2)
        .min(0),

    compareAtPrice:
      Joi.number()
        .precision(2)
        .min(0)
        .allow(null),

    currency:
      currencySchema,

    stock:
      Joi.number()
        .integer()
        .min(0),

    trackInventory:
      Joi.boolean(),

    allowBackorder:
      Joi.boolean(),

    thumbnail:
      imageSchema
        .allow(""),

    image:
      imageSchema
        .allow(""),

    images:
      Joi.array()
        .items(
          imageSchema
        )
        .max(5)
        .unique(),

    video:
      Joi.string()
        .trim()
        .uri({
          scheme: [
            "http",
            "https",
          ],
        })
        .max(2048)
        .allow(""),

    features:
      Joi.array()
        .items(
          textItemSchema
        )
        .max(50)
        .unique(),

    benefits:
      Joi.array()
        .items(
          textItemSchema
        )
        .max(50)
        .unique(),

    specifications:
      specificationsSchema,

    shippingInformation:
      Joi.string()
        .trim()
        .allow("")
        .max(2000),

    returnPolicy:
      Joi.string()
        .trim()
        .allow("")
        .max(2000),

    warranty:
      Joi.string()
        .trim()
        .allow("")
        .max(1000),

    aiKeywords:
      Joi.array()
        .items(
          keywordSchema
        )
        .max(100)
        .unique(),

    liveEnabled:
      Joi.boolean(),

    featured:
      Joi.boolean(),

    status:
      Joi.string()
        .trim()
        .lowercase()
        .valid(
          "draft",
          "active",
          "inactive"
        ),
  })
    .min(1)
    .custom(
      (
        value,
        helpers
      ) => {
        /*
         This check is possible only when both values
         are included in the same update request.

         The service must validate the final merged
         product values when only one price field changes.
        */

        if (
          value.price !==
            undefined &&
          value.compareAtPrice !==
            undefined &&
          value.compareAtPrice !==
            null &&
          value.compareAtPrice <
            value.price
        ) {
          return helpers.error(
            "product.compareAtPrice"
          );
        }

        return value;
      }
    )
    .messages({
      "object.min":
        "At least one product field must be provided",

      "product.compareAtPrice":
        "Compare-at price must be greater than or equal to the product price",
    });

/* =========================================================
   PRODUCT STATUS VALIDATION
========================================================= */

exports.updateProductStatusSchema =
  Joi.object({
    status:
      Joi.string()
        .trim()
        .lowercase()
        .valid(
          "draft",
          "active",
          "inactive"
        )
        .required(),
  });

/* =========================================================
   TRAINING STATUS VALIDATION
   INTERNAL USE ONLY
========================================================= */

exports.updateTrainingStatusSchema =
  Joi.object({
    trainingStatus:
      Joi.string()
        .trim()
        .lowercase()
        .valid(
          ...TRAINING_STATUSES
        )
        .required(),
  });

/* =========================================================
   PRODUCT LIST QUERY VALIDATION
========================================================= */

exports.productListQuerySchema =
  Joi.object({
    page:
      Joi.number()
        .integer()
        .min(1)
        .default(1),

    limit:
      Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(20),

    search:
      Joi.string()
        .trim()
        .max(150)
        .allow(""),

    status:
      Joi.string()
        .trim()
        .lowercase()
        .valid(
          ...PRODUCT_STATUSES
        ),

    category:
      Joi.string()
        .trim()
        .max(100)
        .allow(""),

    twinId:
      objectIdSchema,

    sort:
      Joi.string()
        .valid(
          "newest",
          "oldest",
          "updated",
          "name_asc",
          "name_desc",
          "price_asc",
          "price_desc",
          "stock_asc",
          "stock_desc"
        )
        .default(
          "newest"
        ),

    featured:
      Joi.boolean(),

    liveEnabled:
      Joi.boolean(),

    inStock:
      Joi.boolean(),

    includeArchived:
      Joi.boolean()
        .default(false),
  });