const Twin =
  require("../../models/Twin");

const {
  uploadVideoBuffer,
} = require(
  "../../services/cloudinaryVideo.service"
);

const {
  generateAvatarVideo,
} = require(
  "../../services/avatarVideo.service"
);

/* =========================================================
   PROCESS AVATAR VIDEO
========================================================= */

const processAvatarVideo =
  async ({
    twinId,
    userId,
    imageUrl,
    product,
  }) => {
    try {
      const twin =
        await Twin.findOneAndUpdate(
          {
            _id: twinId,
            userId,
          },
          {
            $set: {
              "appearance.avatarVideoStatus":
                "processing",

              "appearance.avatarVideoUrl":
                "",

              "appearance.avatarVideoPublicId":
                "",

              "appearance.avatarVideoError":
                "",

              "appearance.avatarVideoOperation":
                "",
            },
          },
          {
            new: true,
          }
        );

      if (!twin) {
        throw new Error(
          "AI Twin not found or access denied."
        );
      }

      if (!imageUrl) {
        throw new Error(
          "Avatar image URL is required."
        );
      }

     const {
  videoBuffer,
  operationName,
  model,
  prompt,
} = await generateAvatarVideo({
  imageUrl,
  product,
});

      if (
        !videoBuffer ||
        !Buffer.isBuffer(videoBuffer)
      ) {
        throw new Error(
          "Video generation did not return a valid video buffer."
        );
      }

      const uploaded =
        await uploadVideoBuffer({
          buffer: videoBuffer,

          folder:
            `twinn/users/${userId}/twins/${twinId}`,

          publicId:
            `avatar-motion-${Date.now()}`,
        });

      if (!uploaded?.url) {
        throw new Error(
          "Cloudinary did not return a video URL."
        );
      }

      const updatedTwin =
  await Twin.findOneAndUpdate(
    {
      _id: twinId,
      userId,
    },
    {
      $set: {
        "appearance.avatarVideoUrl":
          uploaded.url,

        "appearance.avatarVideoPublicId":
          uploaded.publicId || "",

        "appearance.avatarVideoStatus":
          "completed",

        "appearance.avatarVideoOperation":
          operationName || "",

        "appearance.avatarVideoModel":
          model || "",

        "appearance.avatarVideoPrompt":
          prompt || "",

        "appearance.avatarVideoGeneratedAt":
          new Date(),

        "appearance.avatarVideoError":
          "",

        "appearance.provider":
          "veo",

        avatarVideoUrl:
          uploaded.url,
      },
    },
    {
      new: true,
    }
  );

      console.log(
        "AVATAR VIDEO READY:",
        {
          twinId,
          url: uploaded.url,
        }
      );

      return updatedTwin;
    } catch (error) {
      console.error(
        "AVATAR VIDEO PROCESSING ERROR:",
        error
      );

      await Twin.findOneAndUpdate(
        {
          _id: twinId,
          userId,
        },
        {
          $set: {
            "appearance.avatarVideoStatus":
              "failed",

            "appearance.avatarVideoError":
              error.message ||
              "Avatar video generation failed.",
          },
        }
      );

      throw error;
    }
  };

module.exports = {
  processAvatarVideo,
};