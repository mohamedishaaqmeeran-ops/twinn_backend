const twinService =
  require("./twin.service");

const getUserId = (req) =>
  req.user?._id || req.user?.id;

const getStatusCode = (
  error,
  fallback = 500
) => {
  if (error.statusCode) {
    return error.statusCode;
  }

  const message = String(
    error.message || ""
  ).toLowerCase();

  if (message.includes("not found")) {
    return 404;
  }

  if (
    message.includes("required") ||
    message.includes("invalid") ||
    message.includes("provide") ||
    message.includes("upload") ||
    message.includes("limit")
  ) {
    return 400;
  }

  return fallback;
};

const sendError = (
  res,
  error,
  fallbackMessage
) => {
  console.error(fallbackMessage, error);

  return res
    .status(getStatusCode(error))
    .json({
      success: false,
      message:
        error.message ||
        fallbackMessage,
    });
};

const checkTwinLimit = async (
  user
) => {
  const plan = String(
    user?.plan || "free"
  ).toLowerCase();

  const limit =
    plan === "pro"
      ? 3
      : plan === "business"
      ? Infinity
      : 1;

  const count =
    await twinService.getTwinCount(
      user._id || user.id
    );

  if (
    Number.isFinite(limit) &&
    count >= limit
  ) {
    const error = new Error(
      `Your ${plan} plan supports only ${limit} AI Twin(s).`
    );

    error.statusCode = 403;

    throw error;
  }
};

exports.saveBasicInfo = async (
  req,
  res
) => {
  try {
    await checkTwinLimit(req.user);

    const twin =
      await twinService.createBasicInfo({
        userId: getUserId(req),
        payload: req.body,
      });

    return res.status(201).json({
      success: true,
      message:
        "AI Twin basic information saved successfully.",
      twin,

      data: {
        id: twin._id,
        twinId: twin._id,
        twin_id: twin._id,
        twin_name: twin.name,
      },
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to save basic information."
    );
  }
};

exports.saveAppearance = async (
  req,
  res
) => {
  try {
    const twin =
      await twinService.saveAppearance({
        userId: getUserId(req),
        payload: req.body,
        file: req.file,
      });

    return res.status(201).json({
      success: true,
      message:
        "AI Twin appearance saved successfully.",
      appearance: twin.appearance,
      twin,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to save appearance."
    );
  }
};

exports.saveVoice = async (
  req,
  res
) => {
  try {
    const twin =
      await twinService.saveVoice({
        userId: getUserId(req),
        payload: req.body,
        file: req.file,
      });

    return res.status(201).json({
      success: true,
      message:
        "AI Twin voice saved successfully.",
      voice: twin.voice,
      twin,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to save voice."
    );
  }
};

exports.saveKnowledge = async (
  req,
  res
) => {
  try {
    const result =
      await twinService.saveKnowledge({
        userId: getUserId(req),
        payload: req.body,
        file: req.file,
      });

    return res.status(201).json({
      success: true,
      message:
        "Knowledge processed and embedded successfully.",
      chunkCount:
        result.chunkCount,
      chunks:
        result.chunks.map(
          (chunk) => ({
            id: chunk._id,
            title:
              chunk.sourceTitle,
            content:
              chunk.content,
            sourceType:
              chunk.sourceType,
          })
        ),
      twin: result.twin,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to process knowledge."
    );
  }
};

exports.chatWithTwin = async (
  req,
  res
) => {
  try {
    const result =
      await twinService.chat({
        userId: getUserId(req),
        payload: req.body,
      });

    return res.json({
      success: true,
      reply: result.reply,
      data: result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to chat with AI Twin."
    );
  }
};

exports.getTwins = async (
  req,
  res
) => {
  try {
    const twins =
      await twinService.getTwins(
        getUserId(req)
      );

    return res.json({
      success: true,
      count: twins.length,
      twins,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to load AI Twins."
    );
  }
};

exports.getTwin = async (
  req,
  res
) => {
  try {
    const twin =
      await twinService.getTwin({
        userId: getUserId(req),
        twinId: req.params.id,
      });

    return res.json({
      success: true,
      twin,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to load AI Twin."
    );
  }
};

exports.getKnowledge = async (
  req,
  res
) => {
  try {
    const knowledge =
      await twinService.getKnowledge({
        userId: getUserId(req),
        twinId: req.params.id,
      });

    return res.json({
      success: true,
      count: knowledge.length,
      knowledge,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to load knowledge."
    );
  }
};

exports.getConversations = async (
  req,
  res
) => {
  try {
    const conversations =
      await twinService.getConversations({
        userId: getUserId(req),
        twinId: req.params.id,
      });

    return res.json({
      success: true,
      conversations,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to load conversations."
    );
  }
};

exports.deleteTwin = async (
  req,
  res
) => {
  try {
    const twin =
      await twinService.deleteTwin({
        userId: getUserId(req),
        twinId: req.params.id,
      });

    return res.json({
      success: true,
      message:
        "AI Twin deleted successfully.",
      deletedTwinId: twin._id,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to delete AI Twin."
    );
  }
};