const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
exports.uploadBuffer = ({ buffer, folder, fileName, mimeType }) => new Promise((resolve, reject) => {
  const resource_type = mimeType?.startsWith("image/") ? "image" : mimeType?.startsWith("audio/") ? "video" : "raw";
  const stream = cloudinary.uploader.upload_stream({ folder, resource_type, public_id: fileName?.replace(/\.[^/.]+$/, "") }, (error, result) => {
    if (error) return reject(error);
    resolve({ url: result.secure_url, publicId: result.public_id });
  });
  streamifier.createReadStream(buffer).pipe(stream);
});
