const express = require("express");
const router = express.Router();

const controller = require("./product.controller");
const auth = require("../../middleware/auth.middleware");
const upload = require("../../config/productUpload");

router.post("/", auth.protect, upload.array("images", 5), controller.create);

router.get("/", auth.protect, controller.list);

router.get("/:id", auth.protect, controller.single);

router.put("/:id", auth.protect, upload.array("images", 5), controller.update);

router.delete("/:id", auth.protect, controller.remove);

module.exports = router;