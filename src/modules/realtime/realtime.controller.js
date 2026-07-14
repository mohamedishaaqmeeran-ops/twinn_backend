const crypto = require("crypto");

const Twin = require("../../models/Twin");
const Product = require("../../models/Product");
const RealtimeSession = require("../../models/RealtimeSession");

exports.createSession = async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      twinId,
      productId = null,
      language = "English",
      mode = "test",
    } = req.body;

    if (!twinId) {
      return res.status(400).json({
        success: false,
        message: "Twin ID is required.",
      });
    }

    /*
     * Critical:
     * Search using both _id and userId.
     * This prevents access to another user's Twin.
     */
    const twin = await Twin.findOne({
      _id: twinId,
      userId,
      status: {
        $ne: "inactive",
      },
    });

    if (!twin) {
      return res.status(404).json({
        success: false,
        message: "AI Twin not found.",
      });
    }

    let product = null;

    if (productId) {
      /*
       * Critical:
       * Product must belong to the authenticated user.
       */
      product = await Product.findOne({
        _id: productId,
        userId,
        status: "active",
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message:
            "Product not found or you do not have permission to access it.",
        });
      }
    }

    const socketToken = crypto
      .randomBytes(32)
      .toString("hex");

    const session = await RealtimeSession.create({
      userId,
      twinId: twin._id,
      productId: product?._id || null,
      language,
      mode,
      socketToken,
      status: "creating",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    return res.status(201).json({
      success: true,
      message: "Realtime session created.",
      session: {
        _id: session._id,
        twinId: session.twinId,
        productId: session.productId,
        language: session.language,
        mode: session.mode,
        socketToken,
      },
    });
  } catch (error) {
    console.error("CREATE REALTIME SESSION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create realtime session.",
    });
  }
};