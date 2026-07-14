const RealtimeSession = require(
  "../../models/RealtimeSession"
);

const Twin = require(
  "../../models/Twin"
);

const Product = require(
  "../../models/Product"
);

/* =========================================================
   CREATE SESSION
========================================================= */

exports.createSession =
  async (req, res) => {
    try {
      const userId =
        req.user._id;

      const {
        twinId,
        productId,
        mode = "test",
        language = "English",
      } = req.body;

      if (!twinId) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Twin ID is required.",
          });
      }

      if (!productId) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Product ID is required.",
          });
      }

      /*
       * Verify that the Twin belongs
       * to the authenticated user.
       */
      const twin =
        await Twin.findOne({
          _id: twinId,
          userId,
          status: {
            $ne: "inactive",
          },
        });

      if (!twin) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "AI Twin not found.",
          });
      }

      /*
       * Verify that the product belongs
       * to the authenticated user.
       */
      const product =
        await Product.findOne({
          _id: productId,
          userId,
          status: {
            $ne: "inactive",
          },
        });

      if (!product) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Product not found.",
          });
      }

      const session =
        await RealtimeSession.create({
          userId,
          twinId:
            twin._id,
          productId:
            product._id,
          mode,
          language,
          status:
            "creating",
        });

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Realtime session created.",

          session,
        });
    } catch (error) {
      console.error(
        "CREATE REALTIME SESSION ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Unable to create realtime session.",
        });
    }
  };

/* =========================================================
   GET SESSION
========================================================= */

exports.getSession =
  async (req, res) => {
    try {
      const userId =
        req.user._id;

      const session =
        await RealtimeSession.findOne({
          _id: req.params.id,
          userId,
        })
          .populate(
            "twinId",
            "name image appearance voice voiceName"
          )
          .populate(
            "productId",
            "name description price currency image status"
          );

      if (!session) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Realtime session not found.",
          });
      }

      return res.json({
        success: true,
        session,
      });
    } catch (error) {
      console.error(
        "GET REALTIME SESSION ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Unable to load realtime session.",
        });
    }
  };

/* =========================================================
   CLOSE SESSION
========================================================= */

exports.closeSession =
  async (req, res) => {
    try {
      const userId =
        req.user._id;

      const session =
        await RealtimeSession.findOneAndUpdate(
          {
            _id: req.params.id,
            userId,
          },
          {
            $set: {
              status:
                "closed",

              endedAt:
                new Date(),
            },
          },
          {
            new: true,
          }
        );

      if (!session) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Realtime session not found.",
          });
      }

      return res.json({
        success: true,

        message:
          "Realtime session closed.",

        session,
      });
    } catch (error) {
      console.error(
        "CLOSE REALTIME SESSION ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Unable to close realtime session.",
        });
    }
  };