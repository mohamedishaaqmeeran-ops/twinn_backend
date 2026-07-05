const express = require("express");
const router = express.Router();

const controller = require("./twin.controller");
const auth = require("../../middleware/auth.middleware");

router.post("/", auth.protect, controller.create);
router.get("/", auth.protect, controller.list);
router.get("/:id", auth.protect, controller.single);
router.put("/:id", auth.protect, controller.update);
router.delete("/:id", auth.protect, controller.remove);

module.exports = router;