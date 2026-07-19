const cloudinary = require("cloudinary").v2;

let configured = false;

const configureCloudinary = () => {
  if (configured) return;

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary environment variables are missing.");
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  configured = true;
};

const uploadVideoToCloudinary = async ({
  filePath,
  folder = "twinn/avatar-videos",
  publicId,
  overwrite = true,
}) => {
  configureCloudinary();

  if (!filePath) {
    throw new Error("A video file path is required for Cloudinary upload.");
  }

  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: "video",
    folder,
    public_id: publicId,
    overwrite,
    invalidate: true,
  });

  return {
    secureUrl: result.secure_url,
    publicId: result.public_id,
    duration: result.duration || 0,
    bytes: result.bytes || 0,
    width: result.width || 0,
    height: result.height || 0,
    format: result.format || "mp4",
    raw: result,
  };
};

const deleteVideoFromCloudinary = async (publicId) => {
  configureCloudinary();

  if (!publicId) {
    return { result: "not found" };
  }

  return cloudinary.uploader.destroy(publicId, {
    resource_type: "video",
    invalidate: true,
  });
};

module.exports = {
  uploadVideoToCloudinary,
  deleteVideoFromCloudinary,
};
