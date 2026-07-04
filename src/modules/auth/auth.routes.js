const express = require("express");
const router = express.Router();

const authController = require("./auth.controller");
const { protect } = require("../../middleware/auth.middleware");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/google", authController.googleLogin);
router.get("/users", authController.getUsers);
router.get("/me", protect, authController.me);
router.post("/logout", authController.logout);

router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/verify-email/:token", authController.verifyEmail);
router.post("/resend-verification", authController.resendVerification);

module.exports = router;