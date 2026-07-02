const express = require("express");
const router = express.Router();

const socialController = require("./social.controller");

router.get("/connections", socialController.getConnections);
router.delete("/connections/:platform", socialController.deleteConnection);

router.get("/callback/:platform", socialController.oauthCallback);
router.get("/:platform", socialController.startOAuth);

module.exports = router;