const Twin =
  require(
    "../../models/Twin"
  );

const {
  generateAvatarVideo,
} = require(
  "../../services/avatarVideo.service"
);

const storageService =
  require(
    "../../services/storage.service"
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

            "appearance.avatarVideoError":
              "",

            "appearance.avatarVideoUrl":
              "",

            avatarVideoUrl:
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

      const uploadedVideo =
        await storageService
          .uploadBuffer({
            buffer:
              videoBuffer,

            folder:
              `twins/${userId}/${twinId}/motion`,

            extension:
              "mp4",

            contentType:
              "video/mp4",
          });

      const updatedTwin =
        await Twin.findOneAndUpdate(
          {
            _id:
              twinId,

            userId,
          },
          {
            $set: {
              "appearance.avatarVideoUrl":
                uploadedVideo.url,

              "appearance.avatarVideoStatus":
                "completed",

              "appearance.avatarVideoError":
                "",

              "appearance.avatarVideoOperation":
                operationName,

              avatarVideoUrl:
                uploadedVideo.url,
            },
          },
          {
            new:
              true,
          }
        );

      console.log(
        "AVATAR VIDEO COMPLETED:",
        {
          twinId,
          videoUrl:
            uploadedVideo.url,
        }
      );

      return updatedTwin;
    } catch (error) {
      console.error(
        "AVATAR VIDEO GENERATION ERROR:",
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
              "Video generation failed.",
          },
        }
      );

      throw error;
    }
  };

module.exports = {
  processAvatarVideo,
};