const cloudinary = require("../../config/cloudinary");

const uploadBuffer = ({
  buffer,
  folder,
  resourceType = "auto",
  publicId,
}) => {
  return new Promise((resolve, reject) => {
    const uploadStream =
      cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,

          ...(publicId
            ? {
                public_id: publicId,
              }
            : {}),
        },

        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type,
            format: result.format,
            bytes: result.bytes,
          });
        }
      );

    uploadStream.end(buffer);
  });
};

const deleteAsset = async ({
  publicId,
  resourceType = "image",
}) => {
  if (!publicId) {
    return;
  }

  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
};

exports.uploadAvatar = async ({
  userId,
  twinId,
  file,
}) => {
  return uploadBuffer({
    buffer: file.buffer,
    folder: `twinn/twins/${userId}/${twinId}/appearance`,
    resourceType: "image",
    publicId: `avatar-${Date.now()}`,
  });
};

exports.uploadVoiceSample = async ({
  userId,
  twinId,
  file,
}) => {
  return uploadBuffer({
    buffer: file.buffer,
    folder: `twinn/twins/${userId}/${twinId}/voice`,
    resourceType: "video",
    publicId: `voice-${Date.now()}`,
  });
};

exports.uploadKnowledgeFile = async ({
  userId,
  twinId,
  file,
}) => {
  return uploadBuffer({
    buffer: file.buffer,
    folder: `twinn/twins/${userId}/${twinId}/knowledge`,
    resourceType: "raw",
    publicId: `knowledge-${Date.now()}`,
  });
};

exports.deleteAsset = deleteAsset;