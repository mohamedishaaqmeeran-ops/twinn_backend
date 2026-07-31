const productService =
  require(
    "./product.service"
  );

const {
  createProductSchema,
  updateProductSchema,
  productListQuerySchema,
} = require(
  "./product.validation"
);

/* =========================================================
   REQUEST USER HELPERS
========================================================= */

const getUserId = (
  req
) => {
  const userId =
    req.userId ||
    req.auth?.userId ||
    req.user?.id ||
    req.user?._id;

  return userId
    ? String(userId)
    : "";
};

const getRole = (
  req
) =>
  req.userRole ||
  req.auth?.role ||
  req.user?.role ||
  "";

const getAccess = (
  req
) => ({
  userId:
    getUserId(req),

  role:
    getRole(req),

  ownerId:
    req.body?.ownerId ||
    req.body
      ?.brandCreatorId ||
    req.query?.ownerId ||
    undefined,
});

/* =========================================================
   JOI VALIDATION ERROR
========================================================= */

const validationError = (
  res,
  error
) => {
  const errors =
    Array.isArray(
      error?.details
    )
      ? error.details.map(
          (item) => ({
            field:
              Array.isArray(
                item.path
              )
                ? item.path.join(
                    "."
                  )
                : String(
                    item.path ||
                      ""
                  ),

            message:
              item.message
                .replace(
                  /"/g,
                  ""
                ),

            type:
              item.type,
          })
        )
      : [
          {
            field: "",
            message:
              error?.message ||
              "Product validation failed",
          },
        ];

  console.error(
    "PRODUCT JOI VALIDATION ERROR:",
    errors
  );

  return res
    .status(400)
    .json({
      success: false,
      code:
        "PRODUCT_VALIDATION_ERROR",
      message:
        errors[0]
          ?.message ||
        "Product validation failed",
      errors,
    });
};

/* =========================================================
   COMMON ERROR HANDLER
========================================================= */

const handleError = (
  res,
  error,
  fallback
) => {
  console.error(
    "PRODUCT CONTROLLER ERROR:",
    error
  );

  if (
    error?.statusCode &&
    error?.code
  ) {
    return res
      .status(
        error.statusCode
      )
      .json({
        success: false,
        code:
          error.code,
        message:
          error.message,
        ...(
          error.details ||
          {}
        ),
      });
  }

  if (
    error?.name ===
    "MulterError"
  ) {
    return res
      .status(400)
      .json({
        success: false,
        code:
          "PRODUCT_UPLOAD_ERROR",
        message:
          error.message,
      });
  }

  /*
   Mongoose validation errors.
  */
  if (
    error?.name ===
    "ValidationError"
  ) {
    const errors =
      Object.entries(
        error.errors || {}
      ).map(
        ([
          field,
          fieldError,
        ]) => ({
          field,
          message:
            fieldError
              ?.message ||
            "Invalid value",
        })
      );

    return res
      .status(400)
      .json({
        success: false,
        code:
          "PRODUCT_DATABASE_VALIDATION_ERROR",
        message:
          errors[0]
            ?.message ||
          "Product validation failed",
        errors,
      });
  }

  if (
    error?.name ===
    "CastError"
  ) {
    return res
      .status(400)
      .json({
        success: false,
        code:
          "INVALID_PRODUCT_FIELD",
        message:
          `Invalid value for ${error.path}`,
        errors: [
          {
            field:
              error.path,
            message:
              error.message,
          },
        ],
      });
  }

  if (
    error?.code ===
    11000
  ) {
    const duplicateField =
      Object.keys(
        error.keyValue ||
          {}
      )[0] ||
      "field";

    return res
      .status(409)
      .json({
        success: false,
        code:
          "DUPLICATE_PRODUCT",
        message:
          `A product with this ${duplicateField} already exists`,
        field:
          duplicateField,
      });
  }

  return res
    .status(500)
    .json({
      success: false,
      code:
        "PRODUCT_OPERATION_FAILED",
      message:
        process.env
          .NODE_ENV ===
        "development"
          ? error?.message ||
            fallback
          : fallback,
    });
};

/* =========================================================
   FIELD PARSERS
========================================================= */

const optionalNumber = (
  value
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : value;
};

const optionalBoolean = (
  value
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  const normalized =
    String(value)
      .trim()
      .toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "on",
    ].includes(normalized)
  ) {
    return true;
  }

  if (
    [
      "false",
      "0",
      "no",
      "off",
    ].includes(normalized)
  ) {
    return false;
  }

  return value;
};

const arrayField = (
  value
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  if (
    Array.isArray(value)
  ) {
    return value
      .map(
        (item) =>
          typeof item ===
          "string"
            ? item.trim()
            : item
      )
      .filter(Boolean);
  }

  try {
    const parsed =
      JSON.parse(value);

    if (
      Array.isArray(parsed)
    ) {
      return parsed
        .map(
          (item) =>
            typeof item ===
            "string"
              ? item.trim()
              : item
        )
        .filter(Boolean);
    }
  } catch {
    // Use comma-separated parsing.
  }

  return String(value)
    .split(",")
    .map(
      (item) =>
        item.trim()
    )
    .filter(Boolean);
};

const objectField = (
  value
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  if (
    typeof value ===
      "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  try {
    const parsed =
      JSON.parse(value);

    if (
      parsed &&
      typeof parsed ===
        "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed;
    }

    return value;
  } catch {
    return value;
  }
};

/* =========================================================
   UPLOADED IMAGE PATH
========================================================= */

const getUploadedImageUrl = (
  file
) =>
  file?.secure_url ||
  file?.location ||
  file?.url ||
  file?.path ||
  file?.filename ||
  "";

/* =========================================================
   REMOVE EMPTY OPTIONAL FIELDS
========================================================= */

const removeEmptyOptionalFields = (
  body
) => {
  const optionalFields = [
    "twinId",
    "sku",
    "slug",
    "video",
  ];

  optionalFields.forEach(
    (field) => {
      if (
        body[field] ===
          undefined ||
        body[field] ===
          null ||
        String(
          body[field]
        ).trim() === ""
      ) {
        delete body[field];
      }
    }
  );

  return body;
};

/* =========================================================
   BUILD PRODUCT BODY
========================================================= */

/* =========================================================
   BUILD PRODUCT BODY
========================================================= */

const buildBody = (
  req,
  isUpdate = false
) => {
  const source =
    req.body || {};

  /*
   Expected price mapping:

   price          = current selling price
   compareAtPrice = original/higher price

   Frontend aliases:

   salePrice      = current selling price
   regularPrice   = original price
   productPrice   = selling price
  */

  const rawSalePrice =
    source.salePrice;

  const rawCurrentPrice =
    source.productPrice ??
    source.price;

  const rawOriginalPrice =
    source.compareAtPrice ??
    source.regularPrice;

  const hasSalePrice =
    rawSalePrice !==
      undefined &&
    rawSalePrice !==
      null &&
    String(
      rawSalePrice
    ).trim() !== "";

  const body = {
    ...source,

    name:
      source.name ??
      source.productName ??
      source.title,

    description:
      source.description ??
      source.productDescription ??
      source.details,

    shortDescription:
      source.shortDescription ??
      source.subtitle,

    category:
      source.category ??
      source.productCategory,

    brand:
      source.brand ??
      source.brandName,

    /*
     When salePrice exists:
     - salePrice becomes price
     - regular/current price becomes compareAtPrice
    */
    price:
      hasSalePrice
        ? rawSalePrice
        : rawCurrentPrice,

    compareAtPrice:
      hasSalePrice
        ? (
            rawOriginalPrice ??
            rawCurrentPrice
          )
        : rawOriginalPrice,

    stock:
      source.stock ??
      source.quantity ??
      source.inventory,

    currency:
      source.currency ||
      "INR",
  };

  /* =========================================================
     REMOVE OWNERSHIP AND FRONTEND ALIAS FIELDS
  ========================================================= */

  delete body.ownerId;
  delete body.brandCreatorId;

  delete body.productName;
  delete body.title;

  delete body.productDescription;
  delete body.details;

  delete body.subtitle;

  delete body.productCategory;
  delete body.brandName;

  delete body.regularPrice;
  delete body.productPrice;
  delete body.salePrice;

  delete body.quantity;
  delete body.inventory;

  /* =========================================================
     NUMBER FIELDS
  ========================================================= */

  for (
    const field of [
      "price",
      "compareAtPrice",
      "stock",
    ]
  ) {
    const parsed =
      optionalNumber(
        body[field]
      );

    if (
      parsed !== undefined
    ) {
      body[field] =
        parsed;
    } else {
      delete body[field];
    }
  }

  /*
   Do not send compareAtPrice when it is empty
   or equal to zero while price is higher.
  */

  if (
    body.compareAtPrice ===
      undefined ||
    body.compareAtPrice ===
      null ||
    body.compareAtPrice ===
      ""
  ) {
    body.compareAtPrice =
      null;
  }

  /*
   Safety validation before Joi.

   compareAtPrice must represent the original
   price and therefore cannot be lower than price.
  */

  if (
    typeof body.price ===
      "number" &&
    typeof body.compareAtPrice ===
      "number" &&
    body.compareAtPrice <
      body.price
  ) {
    /*
     Detect inverted frontend values and swap them.

     Example received:
       price: 5000
       compareAtPrice: 3999

     Correct result:
       price: 3999
       compareAtPrice: 5000
    */

    const sellingPrice =
      body.compareAtPrice;

    body.compareAtPrice =
      body.price;

    body.price =
      sellingPrice;
  }

  /*
   When both prices are identical, the product
   is not discounted. Remove compare-at price.
  */

  if (
    typeof body.price ===
      "number" &&
    typeof body.compareAtPrice ===
      "number" &&
    body.compareAtPrice ===
      body.price
  ) {
    body.compareAtPrice =
      null;
  }

  /* =========================================================
     BOOLEAN FIELDS
  ========================================================= */

  for (
    const field of [
      "trackInventory",
      "allowBackorder",
      "liveEnabled",
      "featured",
    ]
  ) {
    const parsed =
      optionalBoolean(
        source[field]
      );

    if (
      parsed !== undefined
    ) {
      body[field] =
        parsed;
    } else {
      delete body[field];
    }
  }

  /* =========================================================
     ARRAY FIELDS
  ========================================================= */

  for (
    const field of [
      "features",
      "benefits",
      "aiKeywords",
      "images",
    ]
  ) {
    const parsed =
      arrayField(
        source[field]
      );

    if (
      parsed !== undefined
    ) {
      body[field] =
        parsed;
    } else {
      delete body[field];
    }
  }

  /* =========================================================
     SPECIFICATIONS
  ========================================================= */

  const specifications =
    objectField(
      source.specifications
    );

  if (
    specifications !==
    undefined
  ) {
    body.specifications =
      specifications;
  } else {
    delete body.specifications;
  }

  /* =========================================================
     NORMALIZE STRING FIELDS
  ========================================================= */

  const stringFields = [
    "name",
    "description",
    "shortDescription",
    "category",
    "brand",
    "sku",
    "slug",
    "currency",
    "status",
    "shippingInformation",
    "returnPolicy",
    "warranty",
    "video",
    "twinId",
  ];

  stringFields.forEach(
    (field) => {
      if (
        typeof body[field] ===
        "string"
      ) {
        body[field] =
          body[field].trim();
      }
    }
  );

  if (
    typeof body.currency ===
    "string"
  ) {
    body.currency =
      body.currency
        .toUpperCase();
  }

  if (
    typeof body.status ===
    "string"
  ) {
    body.status =
      body.status
        .toLowerCase();
  }

  /* =========================================================
     UPLOADED IMAGES
  ========================================================= */

  const uploaded =
    Array.isArray(
      req.files
    )
      ? req.files
          .map(
            getUploadedImageUrl
          )
          .filter(Boolean)
      : [];

  if (
    uploaded.length
  ) {
    if (
      isUpdate &&
      Array.isArray(
        body.images
      )
    ) {
      body.images = [
        ...new Set([
          ...body.images,
          ...uploaded,
        ]),
      ];
    } else {
      body.images =
        uploaded;
    }

    /*
     Your Joi schema allows only 5 images.
    */

    body.images =
      body.images.slice(
        0,
        5
      );

    body.thumbnail =
      body.thumbnail ||
      uploaded[0];

    body.image =
      body.image ||
      uploaded[0];
  }

  return removeEmptyOptionalFields(
    body
  );
};

/* =========================================================
   CREATE PRODUCT
========================================================= */

exports.create = async (
  req,
  res
) => {
  try {
    const access =
      getAccess(req);

    if (
      !access.userId
    ) {
      return res
        .status(401)
        .json({
          success: false,
          code:
            "AUTHENTICATION_REQUIRED",
          message:
            "Authenticated user information is missing",
        });
    }

    const requestBody =
      buildBody(req);

    console.log(
      "CREATE PRODUCT BODY:",
      {
        ...requestBody,
        images:
          requestBody.images,
      }
    );

    const {
      error,
      value,
    } =
      createProductSchema
        .validate(
          requestBody,
          {
            abortEarly:
              false,
            stripUnknown:
              true,
            convert:
              true,
          }
        );

    if (error) {
      return validationError(
        res,
        error
      );
    }

    const product =
      await productService
        .createProduct(
          access,
          value
        );

    return res
      .status(201)
      .json({
        success: true,
        message:
          "Product created successfully",
        product,
      });
  } catch (error) {
    return handleError(
      res,
      error,
      "Unable to create product"
    );
  }
};

/* =========================================================
   LIST PRODUCTS
========================================================= */

exports.list = async (
  req,
  res
) => {
  try {
    const {
      error,
      value,
    } =
      productListQuerySchema
        .validate(
          req.query,
          {
            abortEarly:
              false,
            stripUnknown:
              true,
            convert:
              true,
          }
        );

    if (error) {
      return validationError(
        res,
        error
      );
    }

    value.ownerId =
      req.query.ownerId;

    const result =
      await productService
        .getProducts(
          getAccess(req),
          value
        );

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Unable to retrieve products"
    );
  }
};

/* =========================================================
   GET SINGLE PRODUCT
========================================================= */

exports.single = async (
  req,
  res
) => {
  try {
    const product =
      await productService
        .getProduct(
          req.params.id,
          getAccess(req)
        );

    if (!product) {
      return res
        .status(404)
        .json({
          success: false,
          code:
            "PRODUCT_NOT_FOUND",
          message:
            "Product not found",
        });
    }

    return res.json({
      success: true,
      product,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Unable to retrieve product"
    );
  }
};

/* =========================================================
   UPDATE PRODUCT
========================================================= */

exports.update = async (
  req,
  res
) => {
  try {
    const requestBody =
      buildBody(
        req,
        true
      );

    const {
      error,
      value,
    } =
      updateProductSchema
        .validate(
          requestBody,
          {
            abortEarly:
              false,
            stripUnknown:
              true,
            convert:
              true,
          }
        );

    if (error) {
      return validationError(
        res,
        error
      );
    }

    const product =
      await productService
        .updateProduct(
          req.params.id,
          getAccess(req),
          value
        );

    if (!product) {
      return res
        .status(404)
        .json({
          success: false,
          code:
            "PRODUCT_NOT_FOUND",
          message:
            "Product not found",
        });
    }

    return res.json({
      success: true,
      message:
        "Product updated successfully",
      product,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Unable to update product"
    );
  }
};

/* =========================================================
   ARCHIVE PRODUCT
========================================================= */

exports.remove = async (
  req,
  res
) => {
  try {
    const product =
      await productService
        .deleteProduct(
          req.params.id,
          getAccess(req)
        );

    if (!product) {
      return res
        .status(404)
        .json({
          success: false,
          code:
            "PRODUCT_NOT_FOUND",
          message:
            "Product not found",
        });
    }

    return res.json({
      success: true,
      message:
        "Product archived successfully",
      product,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Unable to archive product"
    );
  }
};

/* =========================================================
   RESTORE PRODUCT
========================================================= */

exports.restore = async (
  req,
  res
) => {
  try {
    const product =
      await productService
        .restoreProduct(
          req.params.id,
          getAccess(req)
        );

    if (!product) {
      return res
        .status(404)
        .json({
          success: false,
          code:
            "PRODUCT_NOT_FOUND",
          message:
            "Archived product not found",
        });
    }

    return res.json({
      success: true,
      message:
        "Product restored successfully",
      product,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Unable to restore product"
    );
  }
};

/* =========================================================
   PERMANENT DELETE PRODUCT
========================================================= */

exports.permanentRemove =
  async (
    req,
    res
  ) => {
    try {
      const product =
        await productService
          .permanentlyDeleteProduct(
            req.params.id,
            getAccess(req)
          );

      if (!product) {
        return res
          .status(404)
          .json({
            success: false,
            code:
              "PRODUCT_NOT_FOUND",
            message:
              "Product not found",
          });
      }

      return res.json({
        success: true,
        message:
          "Product permanently deleted",
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Unable to permanently delete product"
      );
    }
  };