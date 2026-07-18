const cloudinary =
  require(
    "../config/cloudinary"
  );

/* =========================================================
   UPLOAD VIDEO BUFFER
========================================================= */

const uploadVideoBuffer =
  ({
    buffer,
    folder =
      "twinn/avatar-videos",
    publicId,
  }) => {
    if (
      !Buffer.isBuffer(
        buffer
      )
    ) {
      throw new Error(
        "Valid video buffer is required."
      );
    }

    return new Promise(
      (
        resolve,
        reject
      ) => {
        const stream =
          cloudinary.uploader
            .upload_stream(
              {
                resource_type:
                  "video",

                folder,

                public_id:
                  publicId,

                overwrite:
                  true,
              },
              (
                error,
                result
              ) => {
                if (error) {
                  reject(
                    error
                  );

                  return;
                }

                resolve({
                  url:
                    result.secure_url,

                  publicId:
                    result.public_id,

                  format:
                    result.format,

                  duration:
                    result.duration,
                });
              }
            );

        stream.end(
          buffer
        );
      }
    );
  };

/* =========================================================
   DELETE VIDEO
========================================================= */

const deleteVideo =
  async (
    publicId
  ) => {
    if (!publicId) {
      return;
    }

    await cloudinary.uploader
      .destroy(
        publicId,
        {
          resource_type:
            "video",
        }
      );
  };

module.exports = {
  uploadVideoBuffer,
  deleteVideo,
};