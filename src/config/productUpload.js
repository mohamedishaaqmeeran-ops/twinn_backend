const crypto = require("crypto");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "twinn-products",
    resource_type: "image",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    public_id: `product-${Date.now()}-${crypto.randomUUID()}`,
  }),
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (req, file, callback) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    }
    callback(null, true);
  },
});

module.exports = upload;
