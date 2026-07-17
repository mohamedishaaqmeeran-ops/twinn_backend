const AvatarGeneration = require(
  "../../models/AvatarGeneration"
);

const didAvatarService = require(
  "./didAvatar.service"
);

const createError = (
  message,
  statusCode = 500
) => {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
};

/* =========================================================
   CREATE RECORDED TALKING AVATAR
========================================================= */

exports.createTalkingAvatar =
  async ({
    userId,
    twin,
    text,
    audioUrl,
  }) => {
    if (!userId) {
      throw createError(
        "User ID is required.",
        400
      );
    }

    if (!twin?._id) {
      throw createError(
        "AI Twin is required.",
        400
      );
    }

    const avatarUrl = String(
      twin.appearance?.avatarUrl ||
        twin.image ||
        ""
    ).trim();

    if (!avatarUrl) {
      throw createError(
        "AI Twin avatar image is missing.",
        400
      );
    }

    if (!String(text || "").trim()) {
      throw createError(
        "Avatar script is required.",
        400
      );
    }

    if (
      !String(audioUrl || "").trim()
    ) {
      throw createError(
        "Avatar audio URL is required.",
        400
      );
    }

    const providerResult =
      await didAvatarService.createTalk({
        imageUrl: avatarUrl,

        audioUrl:
          String(audioUrl).trim(),
      });

    if (!providerResult?.id) {
      throw createError(
        "D-ID did not return a generation ID.",
        502
      );
    }

    const status =
      providerResult.status ===
      "done"
        ? "completed"
        : providerResult.status ===
          "error"
        ? "failed"
        : "created";

    return AvatarGeneration.create({
      userId,

      twinId: twin._id,

      provider: "did",

      providerGenerationId:
        providerResult.id,

      text:
        String(text).trim(),

      audioUrl:
        String(audioUrl).trim(),

      videoUrl:
        providerResult.result_url ||
        "",

      status,

      error:
        providerResult.error
          ?.description ||
        "",
    });
  };

/* =========================================================
   GET RECORDED TALKING AVATAR STATUS
========================================================= */

exports.getTalkingAvatarStatus =
  async ({
    generation,
  }) => {
    if (
      !generation
        ?.providerGenerationId
    ) {
      throw createError(
        "Avatar generation provider ID is missing.",
        400
      );
    }

    const providerResult =
      await didAvatarService.getTalk({
        talkId:
          generation
            .providerGenerationId,
      });

    let status =
      "processing";

    if (
      providerResult.status ===
      "done"
    ) {
      status = "completed";
    }

    if (
      providerResult.status ===
      "error"
    ) {
      status = "failed";
    }

    return {
      status,

      videoUrl:
        providerResult.result_url ||
        "",

      error:
        providerResult.error
          ?.description ||
        "",
    };
  };