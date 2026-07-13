const realtimeService =
  require(
    "./realtime.service"
  );

const getUserId = (req) =>
  req.user?._id ||
  req.user?.id;

const sendError = (
  res,
  error,
  fallback
) => {
  console.error(
    fallback,
    error
  );

  return res
    .status(
      error.statusCode || 500
    )
    .json({
      success: false,
      message:
        error.message ||
        fallback,
    });
};

exports.createSession =
  async (req, res) => {
    try {
      const result =
        await realtimeService
          .createSession({
            userId:
              getUserId(req),

            twinId:
              req.body.twinId,

            productId:
              req.body
                .productId ||
              null,

            mode:
              req.body.mode ||
              "test",

            language:
              req.body
                .language ||
              "English",
          });

      return res
        .status(201)
        .json({
          success: true,
          ...result,
        });
    } catch (error) {
      return sendError(
        res,
        error,
        "Unable to create realtime session."
      );
    }
  };

exports.getSession =
  async (req, res) => {
    try {
      const session =
        await realtimeService
          .getSession({
            userId:
              getUserId(req),

            sessionId:
              req.params.id,
          });

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

exports.endSession =
  async (req, res) => {
    try {
      const session =
        await realtimeService
          .endSession({
            userId:
              getUserId(req),

            sessionId:
              req.params.id,
          });

      return res.json({
        success: true,
        message:
          "Realtime session ended.",
        session,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Unable to end realtime session."
      );
    }
  };