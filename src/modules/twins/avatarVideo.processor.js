const Twin =
  require(
    "../../models/Twin"
  );

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
  }) => {
    try {
      await Twin.findOneAndUpdate(
        {
          _id:
            twinId,

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
          },
        }
      );

      const {
        videoBuffer,
        operationName,
      } =
        await generateAvatarVideo({
          imageUrl,
        });

      const uploaded =
        await uploadVideoBuffer({
          buffer:
            videoBuffer,

          folder:
            `twinn/users/${userId}/twins/${twinId}`,

          publicId:
            "avatar-motion",
        });

      await Twin.findOneAndUpdate(
        {
          _id:
            twinId,

          userId,
        },
        {
          $set: {
            "appearance.avatarVideoUrl":
              uploaded.url,

            "appearance.avatarVideoPublicId":
              uploaded.publicId,

            "appearance.avatarVideoStatus":
              "completed",

            "appearance.avatarVideoOperation":
              operationName ||
              "",

            "appearance.avatarVideoGeneratedAt":
              new Date(),

            "appearance.avatarVideoError":
              "",

            "appearance.provider":
              "custom",
          },
        }
      );

      console.log(
        "AVATAR VIDEO READY:",
        {
          twinId,
          url:
            uploaded.url,
        }
      );
    } catch (error) {
      console.error(
        "AVATAR VIDEO PROCESSING ERROR:",
        error
      );

      await Twin.findOneAndUpdate(
        {
          _id:
            twinId,

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
    }
  };

module.exports = {
  processAvatarVideo,
};