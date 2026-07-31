const Product =
  require(
    "../models/Product"
  );

const {
  getPlanLimit,
  normalizePlan,
} = require(
  "../config/plans"
);

const checkProductLimit =
  async (
    req,
    res,
    next
  ) => {
    try {
      const userId =
        req.user?._id ||
        req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "Authentication is required",
          });
      }

      const plan =
        normalizePlan(
          req.user?.plan ||
            req.user
              ?.subscription
              ?.plan ||
            "free"
        );

      const limit =
        getPlanLimit(
          plan,
          "products"
        );

      if (
        limit === Infinity
      ) {
        return next();
      }

      const productCount =
        await Product.countDocuments({
          userId,
        });

      if (
        productCount >=
        limit
      ) {
        return res
          .status(403)
          .json({
            success: false,
            code:
              "PRODUCT_LIMIT_REACHED",
            message:
              `Your ${plan} plan supports up to ${limit} products.`,
            plan,
            limit,
            current:
              productCount,
          });
      }

      return next();
    } catch (error) {
      console.error(
        "PRODUCT LIMIT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Unable to verify product limit",
        });
    }
  };

module.exports = {
  checkProductLimit,
};