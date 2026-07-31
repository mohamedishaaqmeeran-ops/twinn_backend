const mongoose =
  require("mongoose");

const Product =
  require(
    "../../models/Product"
  );


  const User =
  require(
    "../../models/User"
  );

const {
  getPlanLimit,
} = require(
  "../../config/plans"
);

/* =========================================================
   ACCESS HELPERS
========================================================= */

const normalizeRole = (
  value
) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(
      /[\s_-]/g,
      ""
    );

const getActor = (
  actor
) => {
  if (
    !actor ||
    typeof actor !==
      "object"
  ) {
    throw new ProductServiceError(
      "Authenticated user information is required",
      401,
      "AUTHENTICATION_REQUIRED"
    );
  }

  const userId =
    actor.userId ||
    actor.id ||
    actor._id;

  validateObjectId(
    userId,
    "userId"
  );

  return {
    userId:
      String(userId),

    role:
      normalizeRole(
        actor.role
      ),
  };
};

const isPrivilegedProductManager = (
  role
) =>
  role === "admin" ||
  role === "manager";

const isBrandCreator = (
  role
) =>
  role === "brandcreator";

const isProductViewer = (
  role
) =>
  role === "user" ||
  role === "contentcreator";

/* =========================================================
   RESOLVE PRODUCT OWNER
========================================================= */

const resolveCreateOwnerId =
  async (
    actor,
    requestedOwnerId
  ) => {
    const normalizedActor =
      getActor(actor);

    if (
      isBrandCreator(
        normalizedActor.role
      )
    ) {
      return normalizedActor
        .userId;
    }

    if (
      !isPrivilegedProductManager(
        normalizedActor.role
      )
    ) {
      throw new ProductServiceError(
        "You do not have permission to create products",
        403,
        "PRODUCT_CREATE_FORBIDDEN"
      );
    }

    if (!requestedOwnerId) {
      throw new ProductServiceError(
        "ownerId is required when an admin or manager creates a product",
        400,
        "PRODUCT_OWNER_REQUIRED"
      );
    }

    validateObjectId(
      requestedOwnerId,
      "ownerId"
    );

    const owner =
      await User.findById(
        requestedOwnerId
      )
        .select(
          "_id role plan subscriptionStatus trialEndsAt subscriptionEndsAt"
        )
        .lean();

    if (!owner) {
      throw new ProductServiceError(
        "Selected product owner was not found",
        404,
        "PRODUCT_OWNER_NOT_FOUND"
      );
    }

    if (
      normalizeRole(
        owner.role
      ) !==
      "brandcreator"
    ) {
      throw new ProductServiceError(
        "Products can only be assigned to Brand Creator accounts",
        400,
        "INVALID_PRODUCT_OWNER"
      );
    }

    return String(
      owner._id
    );
  };

/* =========================================================
   BUILD ROLE-BASED ACCESS FILTER
========================================================= */

const buildAccessFilter = (
  actor,
  {
    operation = "read",
    ownerId,
  } = {}
) => {
  const normalizedActor =
    getActor(actor);

  if (
    isPrivilegedProductManager(
      normalizedActor.role
    )
  ) {
    const filter = {};

    if (ownerId) {
      validateObjectId(
        ownerId,
        "ownerId"
      );

      filter.userId =
        ownerId;
    }

    return filter;
  }

  if (
    isBrandCreator(
      normalizedActor.role
    )
  ) {
    return {
      userId:
        normalizedActor.userId,
    };
  }

  if (
    operation === "read" &&
    isProductViewer(
      normalizedActor.role
    )
  ) {
    return {
      status:
        "active",
    };
  }

  throw new ProductServiceError(
    "You do not have permission to perform this product operation",
    403,
    "PRODUCT_ACCESS_FORBIDDEN"
  );
};
/* =========================================================
   ALLOWED FIELDS
========================================================= */

const CREATE_FIELDS = [
  "twinId",

  "name",
  "description",
  "shortDescription",

  "category",
  "brand",
  "sku",

  "price",
  "compareAtPrice",
  "currency",

  "stock",
  "trackInventory",
  "allowBackorder",

  "thumbnail",
  "image",
  "images",
  "video",

  "features",
  "benefits",
  "specifications",

  "shippingInformation",
  "returnPolicy",
  "warranty",

  "aiKeywords",

  "liveEnabled",
  "featured",

  "status",
];

const UPDATE_FIELDS = [
  ...CREATE_FIELDS,
];

/* =========================================================
   SERVICE ERROR
========================================================= */

class ProductServiceError extends Error {
  constructor(
    message,
    statusCode = 400,
    code = "PRODUCT_ERROR",
    details = {}
  ) {
    super(message);

    this.name =
      "ProductServiceError";

    this.statusCode =
      statusCode;

    this.code =
      code;

    this.details =
      details;
  }
}

/* =========================================================
   HELPERS
========================================================= */

const validateObjectId = (
  value,
  fieldName
) => {
  if (
    !mongoose.Types.ObjectId.isValid(
      value
    )
  ) {
    throw new ProductServiceError(
      `Invalid ${fieldName}`,
      400,
      "INVALID_OBJECT_ID",
      {
        field:
          fieldName,
      }
    );
  }
};

const pickAllowedFields = (
  source,
  allowedFields
) => {
  const output = {};

  if (
    !source ||
    typeof source !==
      "object" ||
    Array.isArray(source)
  ) {
    return output;
  }

  allowedFields.forEach(
    (field) => {
      if (
        Object.prototype
          .hasOwnProperty.call(
            source,
            field
          )
      ) {
        output[field] =
          source[field];
      }
    }
  );

  return output;
};

const escapeRegex = (
  value
) =>
  String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

const normalizePagination = ({
  page = 1,
  limit = 20,
} = {}) => {
  const normalizedPage =
    Math.max(
      Number.parseInt(
        page,
        10
      ) || 1,
      1
    );

  const normalizedLimit =
    Math.min(
      Math.max(
        Number.parseInt(
          limit,
          10
        ) || 20,
        1
      ),
      100
    );

  return {
    page:
      normalizedPage,

    limit:
      normalizedLimit,

    skip:
      (
        normalizedPage -
        1
      ) *
      normalizedLimit,
  };
};

const normalizeSort = (
  sort
) => {
  const allowedSorts = {
    newest: {
      createdAt: -1,
    },

    oldest: {
      createdAt: 1,
    },

    name_asc: {
      name: 1,
    },

    name_desc: {
      name: -1,
    },

    price_asc: {
      price: 1,
    },

    price_desc: {
      price: -1,
    },

    stock_asc: {
      stock: 1,
    },

    stock_desc: {
      stock: -1,
    },

    updated: {
      updatedAt: -1,
    },
  };

  return (
    allowedSorts[sort] ||
    allowedSorts.newest
  );
};

const buildProductFilter = (
  access,
  options = {}
) => {
  const filter =
    buildAccessFilter(
      {
        userId:
          access.userId,

        role:
          access.role,
      },
      {
        operation:
          "read",

        ownerId:
          options.ownerId,
      }
    );

  /*
   Users and content creators only
   receive active products.
  */
  if (
    isProductViewer(
      access.role
    )
  ) {
    filter.status =
      "active";
  } else if (
    options.status
  ) {
    filter.status =
      String(
        options.status
      )
        .trim()
        .toLowerCase();
  } else if (
    !options.includeArchived
  ) {
    filter.status = {
      $ne: "archived",
    };
  }

  if (
    options.category
  ) {
    filter.category =
      String(
        options.category
      ).trim();
  }

  if (
    options.twinId
  ) {
    validateObjectId(
      options.twinId,
      "twinId"
    );

    filter.twinId =
      options.twinId;
  }

  if (
    typeof options.featured ===
    "boolean"
  ) {
    filter.featured =
      options.featured;
  }

  if (
    typeof options.liveEnabled ===
    "boolean"
  ) {
    filter.liveEnabled =
      options.liveEnabled;
  }

  if (
    options.inStock === true
  ) {
    filter.stock = {
      $gt: 0,
    };
  }

  if (
    options.search
  ) {
    const search =
      escapeRegex(
        String(
          options.search
        ).trim()
      );

    const searchConditions = [
      {
        name: {
          $regex: search,
          $options: "i",
        },
      },
      {
        description: {
          $regex: search,
          $options: "i",
        },
      },
      {
        brand: {
          $regex: search,
          $options: "i",
        },
      },
      {
        category: {
          $regex: search,
          $options: "i",
        },
      },
      {
        sku: {
          $regex: search,
          $options: "i",
        },
      },
    ];

    /*
     Preserve any existing $or access
     rules instead of overwriting them.
    */
    if (
      Array.isArray(
        filter.$or
      )
    ) {
      filter.$and = [
        {
          $or:
            filter.$or,
        },
        {
          $or:
            searchConditions,
        },
      ];

      delete filter.$or;
    } else {
      filter.$or =
        searchConditions;
    }
  }

  return filter;
};


const buildManagementFilter = (
  productId,
  access
) => {
  validateObjectId(
    productId,
    "productId"
  );

  const accessFilter =
    buildAccessFilter(
      {
        userId:
          access.userId,

        role:
          access.role,
      },
      {
        operation:
          "write",

        ownerId:
          access.ownerId,
      }
    );

  return {
    ...accessFilter,
    _id:
      productId,
  };
};
/* =========================================================
   CREATE PRODUCT
========================================================= */

exports.createProduct =
  async (
    access,
    body
  ) => {
    const normalizedActor =
      getActor(access);

    const productOwnerId =
      await resolveCreateOwnerId(
        normalizedActor,
        access.ownerId
      );

    const payload =
      pickAllowedFields(
        body,
        CREATE_FIELDS
      );

    payload.userId =
      productOwnerId;

    if (
      payload.twinId
    ) {
      validateObjectId(
        payload.twinId,
        "twinId"
      );
    }

    if (
      payload.sku
    ) {
      const normalizedSku =
        String(
          payload.sku
        )
          .trim()
          .toUpperCase();

      const duplicate =
        await Product.exists({
          userId:
            productOwnerId,

          sku:
            normalizedSku,
        });

      if (
        duplicate
      ) {
        throw new ProductServiceError(
          "A product with this SKU already exists",
          409,
          "DUPLICATE_PRODUCT_SKU"
        );
      }

      payload.sku =
        normalizedSku;
    }

    return Product.create(
      payload
    );
  };

/* =========================================================
   GET PRODUCTS
========================================================= */

exports.getProducts =
  async (
    access,
    options = {}
  ) => {
    const filter =
      buildProductFilter(
        access,
        options
      );

    const {
      page,
      limit,
      skip,
    } =
      normalizePagination(
        options
      );

    const sort =
      normalizeSort(
        options.sort
      );

    const [
      products,
      total,
    ] =
      await Promise.all([
        Product.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),

        Product.countDocuments(
          filter
        ),
      ]);

    return {
      products,

      pagination: {
        page,
        limit,
        total,

        totalPages:
          Math.max(
            Math.ceil(
              total / limit
            ),
            1
          ),

        hasNextPage:
          skip +
            products.length <
          total,

        hasPreviousPage:
          page > 1,
      },
    };
  };

/* =========================================================
   GET SINGLE PRODUCT
========================================================= */

exports.getProduct =
  async (
    id,
    access
  ) => {
    validateObjectId(
      id,
      "productId"
    );

    const filter =
      buildAccessFilter(
        {
          userId:
            access.userId,

          role:
            access.role,
        },
        {
          operation:
            "read",

          ownerId:
            access.ownerId,
        }
      );

    filter._id =
      id;

    if (
      isProductViewer(
        normalizeRole(
          access.role
        )
      )
    ) {
      filter.status =
        "active";
    }

    return Product.findOne(
      filter
    );
  };

/* =========================================================
   GET PRODUCT OR THROW
========================================================= */

exports.getProductOrThrow =
  async (
    id,
    access
  ) => {
    const product =
      await exports.getProduct(
        id,
        access
      );

    if (
      !product
    ) {
      throw new ProductServiceError(
        "Product not found",
        404,
        "PRODUCT_NOT_FOUND"
      );
    }

    return product;
  };

/* =========================================================
   UPDATE PRODUCT
========================================================= */

exports.updateProduct =
  async (
    id,
    access,
    body
  ) => {
    const filter =
      buildManagementFilter(
        id,
        access
      );

    const payload =
      pickAllowedFields(
        body,
        UPDATE_FIELDS
      );

    if (
      !Object.keys(
        payload
      ).length
    ) {
      throw new ProductServiceError(
        "No valid product fields were provided",
        400,
        "NO_PRODUCT_FIELDS"
      );
    }

    delete payload.userId;
    delete payload.ownerId;
    delete payload._id;
    delete payload.createdAt;
    delete payload.updatedAt;

    if (payload.twinId) {
      validateObjectId(
        payload.twinId,
        "twinId"
      );
    }

    /*
     Check SKU against the product's actual owner.
    */
    const existingProduct =
      await Product.findOne(
        filter
      ).select(
        "userId price compareAtPrice"
      );

    if (!existingProduct) {
      return null;
    }

    if (payload.sku) {
      const normalizedSku =
        String(payload.sku)
          .trim()
          .toUpperCase();

      const duplicate =
        await Product.exists({
          userId:
            existingProduct.userId,

          sku:
            normalizedSku,

          _id: {
            $ne: id,
          },
        });

      if (duplicate) {
        throw new ProductServiceError(
          "A product with this SKU already exists",
          409,
          "DUPLICATE_PRODUCT_SKU"
        );
      }

      payload.sku =
        normalizedSku;
    }

    /*
     Validate final price values even when only one price
     field is updated.
    */
    const finalPrice =
      payload.price ??
      existingProduct.price;

    const finalCompareAtPrice =
      Object.prototype
        .hasOwnProperty.call(
          payload,
          "compareAtPrice"
        )
        ? payload.compareAtPrice
        : existingProduct
            .compareAtPrice;

    if (
      finalCompareAtPrice !==
        null &&
      finalCompareAtPrice !==
        undefined &&
      finalCompareAtPrice <
        finalPrice
    ) {
      throw new ProductServiceError(
        "Compare-at price must be greater than or equal to the product price",
        400,
        "INVALID_COMPARE_AT_PRICE"
      );
    }

    const trainingFields = [
      "name",
      "description",
      "shortDescription",
      "features",
      "benefits",
      "specifications",
      "shippingInformation",
      "returnPolicy",
      "warranty",
      "price",
      "currency",
      "stock",
    ];

    const requiresRetraining =
      trainingFields.some(
        (field) =>
          Object.prototype
            .hasOwnProperty.call(
              payload,
              field
            )
      );

    if (requiresRetraining) {
      payload.trainingStatus =
        "pending";
    }

    return Product.findOneAndUpdate(
      filter,
      {
        $set: payload,
      },
      {
        new: true,
        runValidators: true,
        context: "query",
      }
    );
  };

/* =========================================================
   UPDATE PRODUCT OR THROW
========================================================= */

exports.updateProductOrThrow =
  async (
    id,
    access,
    body
  ) => {
    const product =
      await exports.updateProduct(
        id,
        access,
        body
      );

    if (!product) {
      throw new ProductServiceError(
        "Product not found",
        404,
        "PRODUCT_NOT_FOUND"
      );
    }

    return product;
  };

/* =========================================================
   SOFT DELETE PRODUCT
========================================================= */

exports.deleteProduct =
async (id, access) => {

  const filter =
    buildManagementFilter(
      id,
      access
    );

  return Product.findOneAndUpdate(
    filter,
    {
      $set: {
        status: "archived",
        liveEnabled: false,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

/* =========================================================
   PERMANENT DELETE
   ADMIN OR EXPLICIT CLEANUP ONLY
========================================================= */

exports.permanentlyDeleteProduct =
  async (
    id,
    userId
  ) => {
    validateObjectId(
      id,
      "productId"
    );

    validateObjectId(
      userId,
      "userId"
    );

    return Product.findOneAndDelete({
      _id: id,
      userId,
    });
  };

/* =========================================================
   RESTORE PRODUCT
========================================================= */

exports.restoreProduct =
async (id, access) => {

  const filter =
    buildManagementFilter(
      id,
      access
    );

  filter.status = "archived";

  return Product.findOneAndUpdate(
    filter,
    {
      $set: {
        status: "inactive",
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

/* =========================================================
   PRODUCT COUNT
========================================================= */

exports.getProductCount =
  async (
    access,
    options = {}
  ) => {
    const filter =
      buildProductFilter(
        access,
        options
      );

    return Product.countDocuments(
      filter
    );
  };

/* =========================================================
   UPDATE TRAINING STATUS
========================================================= */

exports.updateTrainingStatus =
  async (
    id,
    userId,
    trainingStatus
  ) => {
    const allowedStatuses = [
      "pending",
      "processing",
      "completed",
      "failed",
    ];

    if (
      !allowedStatuses.includes(
        trainingStatus
      )
    ) {
      throw new ProductServiceError(
        "Invalid product training status",
        400,
        "INVALID_TRAINING_STATUS"
      );
    }

    return Product.findOneAndUpdate(
      {
        _id: id,
        userId,
      },
      {
        $set: {
          trainingStatus,
        },
      },
      {
        new: true,
        runValidators:
          true,
      }
    );
  };

/* =========================================================
   EXPORT ERROR CLASS
========================================================= */

exports.ProductServiceError =
  ProductServiceError;