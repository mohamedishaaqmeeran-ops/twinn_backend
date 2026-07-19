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
    twin,
    product,
  }) => {
    try {
      const existingTwin =
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

              "appearance.avatarVideoModel":
                process.env
                  .VEO_VIDEO_MODEL ||
                "veo-3.1-generate-preview",

              "appearance.avatarVideoGeneratedAt":
                null,

              "appearance.provider":
                "veo",
            },
          },
          {
            new: true,
          }
        );

      if (!existingTwin) {
        throw new Error(
          "AI Twin not found or access denied."
        );
      }

      if (!imageUrl) {
        throw new Error(
          "Avatar image URL is required."
        );
      }

      if (!product) {
        throw new Error(
          "Product details are required."
        );
      }
      if (!product._id) {
  throw new Error(
    "Product ID is missing."
  );
}

      const {
        videoBuffer,
        operationName,
        model,
        prompt,
        speech,
      } =
        await generateAvatarVideo({
          imageUrl,
          twin:
            twin ||
            existingTwin.toObject(),
          product,
        });

      if (
        !videoBuffer ||
        !Buffer.isBuffer(
          videoBuffer
        )
      ) {
        throw new Error(
          "Video generation did not return a valid video buffer."
        );
      }

      const uploaded =
        await uploadVideoBuffer({
          buffer:
            videoBuffer,

          folder:
            `twinn/users/${userId}/twins/${twinId}`,

          publicId:
            `avatar-motion-${Date.now()}`,
        });

      const videoUrl =
  uploaded.secureUrl ||
  uploaded.url;

if (!videoUrl) {
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
                videoUrl,

              "appearance.avatarVideoPublicId":
                uploaded.publicId ||
                "",

              "appearance.avatarVideoStatus":
                "completed",

              "appearance.avatarVideoOperation":
                operationName ||
                "",

              "appearance.avatarVideoModel":
                model || "",

              "appearance.avatarVideoPrompt":
                prompt || "",

              "appearance.avatarVideoSpeech":
                speech || "",

              "appearance.avatarVideoProductId":
                product._id,

              "appearance.avatarVideoProductName":
                product.name ||
                "",

              "appearance.avatarVideoGeneratedAt":
                new Date(),

              "appearance.avatarVideoError":
                "",

              "appearance.provider":
                "veo",

             
            },

            $addToSet: {
              productIds:
                product._id,
            },
          },
          {
            new: true,
            runValidators: true,
          }
        );

      console.log(
        "AVATAR VIDEO READY:",
        {
          twinId,
          productId:
            product._id,
          url:
            uploaded.url,
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
              error?.message ||
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