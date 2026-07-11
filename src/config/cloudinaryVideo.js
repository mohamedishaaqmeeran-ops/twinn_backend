const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const videoStorage = new CloudinaryStorage({
  cloudinary,

  params: async (req, file) => ({
    folder: "twinn/live-videos",

    resource_type: "video",

    public_id: `live-${req.user.id}-${Date.now()}`,

    allowed_formats: [
      "mp4",
      "mov",
      "webm",
      "mkv",
    ],

    transformation: [
      {
        quality: "auto",
        fetch_format: "mp4",
      },
    ],
  }),
});

const uploadVideo = multer({
  storage: videoStorage,

  limits: {
    fileSize: 200 * 1024 * 1024,
  },

  fileFilter: (req, file, callback) => {
    if (!file.mimetype.startsWith("video/")) {
      return callback(
        new Error("Only video files are allowed.")
      );
    }

    callback(null, true);
  },
});

module.exports = uploadVideo;