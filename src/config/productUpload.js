const cloudinary =
  require("./cloudinary");

const {
  CloudinaryStorage,
} = require(
  "multer-storage-cloudinary"
);

const multer =
  require("multer");

const storage =
  new CloudinaryStorage({
    cloudinary,

    params: async (
      req,
      file
    ) => ({
      folder:
        "twinn-products",

      allowed_formats: [
        "jpg",
        "jpeg",
        "png",
        "webp",
      ],

      public_id:
        `product-${Date.now()}`,
    }),
  });

const upload = multer({
  storage,

  limits: {
    fileSize:
      10 * 1024 * 1024,
  },
});

module.exports = upload;