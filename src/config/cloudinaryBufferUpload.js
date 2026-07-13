const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name:
    process.env.CLOUDINARY_CLOUD_NAME,

  api_key:
    process.env.CLOUDINARY_API_KEY,

  api_secret:
    process.env.CLOUDINARY_API_SECRET,
});

const uploadBuffer = ({
  buffer,
  folder,
  resourceType = "auto",
  publicId,
}) => {
  return new Promise(
    (resolve, reject) => {
      const stream =
        cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type:
              resourceType,

            ...(publicId
              ? {
                  public_id:
                    publicId,
                }
              : {}),
          },

          (error, result) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(result);
          }
        );

      stream.end(buffer);
    }
  );
};

module.exports = {
  uploadBuffer,
};