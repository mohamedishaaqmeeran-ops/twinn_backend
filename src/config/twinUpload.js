const multer = require("multer");

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",

  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/ogg",
  "audio/webm",

  "application/pdf",
  "text/plain",
  "text/csv",

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const upload = multer({
  storage:
    multer.memoryStorage(),

  limits: {
    fileSize:
      25 * 1024 * 1024,
  },

  fileFilter(
    req,
    file,
    callback
  ) {
    if (
      !allowedMimeTypes.includes(
        file.mimetype
      )
    ) {
      const error = new Error(
        `Unsupported file type: ${file.mimetype}`
      );

      error.statusCode = 400;

      return callback(error);
    }

    return callback(
      null,
      true
    );
  },
});

module.exports = upload;