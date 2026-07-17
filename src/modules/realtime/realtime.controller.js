const crypto =
  require("crypto");

const RealtimeSession =
  require(
    "../../models/RealtimeSession"
  );

const Twin =
  require(
    "../../models/Twin"
  );

const Product =
  require(
    "../../models/Product"
  );

/* =========================================================
   HELPERS
========================================================= */

const getUserId = (
  req
) => {
  return (
    req.user?._id ||
    req.user?.id
  );
};

const sendError = (
  res,
  error,
  fallbackMessage
) => {
  console.error(
    fallbackMessage,
    {
      message:
        error?.message,
      stack:
        error?.stack,
    }
  );

  return res
    .status(
      error?.statusCode ||
        500
    )
    .json({
      success: false,

      message:
        error?.message ||
        fallbackMessage,
    });
};

const createError = (
  message,
  statusCode = 500
) => {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  return error;
};

const getSocketBaseUrl =
  (
    req
  ) => {
    const configuredUrl =
      String(
        process.env
          .REALTIME_SOCKET_URL ||
          ""
      ).trim();

    if (configuredUrl) {
      return configuredUrl;
    }

    const forwardedHost =
      req.headers[
        "x-forwarded-host"
      ];

    const host =
      forwardedHost ||
      req.headers.host;

    if (!host) {
      throw createError(
        "Unable to determine realtime socket host.",
        500
      );
    }

    const forwardedProto =
      String(
        req.headers[
          "x-forwarded-proto"
        ] ||
          ""
      )
        .split(",")[0]
        .trim();

    const requestProtocol =
      forwardedProto ||
      req.protocol ||
      "http";

    const socketProtocol =
      requestProtocol ===
      "https"
        ? "wss"
        : "ws";

    return `${socketProtocol}://${host}/api/realtime/socket`;
  };

/* =========================================================
   CREATE REALTIME SESSION
========================================================= */

exports.createSession =
  async (
    req,
    res
  ) => {
    try {
      const userId =
        getUserId(req);

      if (!userId) {
        throw createError(
          "Authentication is required.",
          401
        );
      }

      const twinId =
        String(
          req.body?.twinId ||
            ""
        ).trim();

      const productId =
        String(
          req.body?.productId ||
            ""
        ).trim();

      const productName =
        String(
          req.body
            ?.productName ||
            ""
        ).trim();

      const language =
        String(
          req.body
            ?.language ||
            "English"
        ).trim();

      const mode =
        String(
          req.body?.mode ||
            "test"
        ).trim();

      if (!twinId) {
        throw createError(
          "Twin ID is required.",
          400
        );
      }

      /*
       * Verify that the selected Twin
       * belongs to the logged-in user.
       */

      const twin =
        await Twin.findOne({
          _id:
            twinId,

          userId,
        });

      if (!twin) {
        throw createError(
          "AI Twin was not found.",
          404
        );
      }

      /*
       * Product can be optional depending
       * on your workflow.
       */

      let product =
        null;

      if (productId) {
        product =
          await Product.findOne({
            _id:
              productId,

            userId,
          });

        if (!product) {
          throw createError(
            "Selected product was not found.",
            404
          );
        }
      }

      const socketToken =
        crypto
          .randomBytes(32)
          .toString("hex");

      const expiresAt =
        new Date(
          Date.now() +
            30 *
              60 *
              1000
        );

      const session =
        await RealtimeSession.create({
          userId,

          twinId:
            twin._id,

          productId:
            product?._id ||
            null,

          productName:
            product?.name ||
            productName ||
            "",

          language,

          mode,

          status:
            "created",

          socketToken,

          expiresAt,

          createdAt:
            new Date(),
        });

      const socketUrl =
        getSocketBaseUrl(
          req
        );

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Realtime session created successfully.",

          session: {
            _id:
              session._id,

            id:
              session._id,

            userId:
              session.userId,

            twinId:
              session.twinId,

            productId:
              session.productId,

            productName:
              session.productName,

            language:
              session.language,

            mode:
              session.mode,

            status:
              session.status,

            expiresAt:
              session.expiresAt,
          },

          sessionId:
            session._id,

          socketUrl,

          socketToken,
        });
    } catch (error) {
      return sendError(
        res,
        error,
        "Unable to create realtime session."
      );
    }
  };

/* =========================================================
   GET REALTIME SESSION
========================================================= */

exports.getSession =
  async (
    req,
    res
  ) => {
    try {
      const userId =
        getUserId(req);

      const session =
        await RealtimeSession
          .findOne({
            _id:
              req.params.id,

            userId,
          })
          .select(
            "-socketToken"
          )
          .lean();

      if (!session) {
        throw createError(
          "Realtime session was not found.",
          404
        );
      }

      return res.json({
        success: true,

        session,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Unable to load realtime session."
      );
    }
  };

/* =========================================================
   CLOSE REALTIME SESSION
========================================================= */

exports.closeSession =
  async (
    req,
    res
  ) => {
    try {
      const userId =
        getUserId(req);

      const session =
        await RealtimeSession
          .findOne({
            _id:
              req.params.id,

            userId,
          });

      if (!session) {
        throw createError(
          "Realtime session was not found.",
          404
        );
      }

      /*
       * Keep this route idempotent.
       * Calling it multiple times should
       * not cause an error.
       */

      if (
        ![
          "closed",
          "ended",
        ].includes(
          String(
            session.status ||
              ""
          ).toLowerCase()
        )
      ) {
        session.status =
          "closed";

        session.endedAt =
          new Date();

        await session.save();
      }

      return res.json({
        success: true,

        message:
          "Realtime session closed successfully.",

        session: {
          _id:
            session._id,

          status:
            session.status,

          endedAt:
            session.endedAt,
        },
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Unable to close realtime session."
      );
    }
  };