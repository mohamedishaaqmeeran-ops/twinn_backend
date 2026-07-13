const multer = require("multer");

const maxFileSize =
  Number(process.env.MAX_KNOWLEDGE_FILE_SIZE_MB || 20) *
  1024 *
  1024;

const allowedMimeTypes = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",

  // Audio
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/ogg",
  "audio/webm",

  // Documents
  "text/plain",
  "text/csv",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: maxFileSize,
  },

  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(
        new Error(`Unsupported file type: ${file.mimetype}`)
      );
    }

    callback(null, true);
  },
});

module.exports = upload;