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

    const avatarUrl =
      String(
        twin.appearance?.avatarUrl ||
          twin.image ||
          ""
      ).trim();

    const cleanText =
      String(text || "").trim();

    const cleanAudioUrl =
      String(audioUrl || "").trim();

    if (!avatarUrl) {
      throw createError(
        "AI Twin avatar image is missing.",
        400
      );
    }

    if (!cleanText) {
      throw createError(
        "Avatar script is required.",
        400
      );
    }

    if (!cleanAudioUrl) {
      throw createError(
        "Avatar audio URL is required.",
        400
      );
    }

    const providerResult =
      await didAvatarService.createTalk({
        imageUrl: avatarUrl,
        audioUrl: cleanAudioUrl,
      });

    if (!providerResult?.id) {
      throw createError(
        "D-ID did not return a generation ID.",
        502
      );
    }

    let status = "created";

    if (
      providerResult.status === "done"
    ) {
      status = "completed";
    } else if (
      providerResult.status === "error"
    ) {
      status = "failed";
    }

    return AvatarGeneration.create({
      userId,
      twinId: twin._id,
      provider: "did",

      providerGenerationId:
        providerResult.id,

      text: cleanText,
      audioUrl: cleanAudioUrl,

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
   GET RECORDED TALK STATUS
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
      providerResult.status === "done"
    ) {
      status = "completed";
    } else if (
      providerResult.status === "error"
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
