const express =
  require("express");

const rateLimit =
  require(
    "express-rate-limit"
  );

const authController =
  require(
    "./auth.controller"
  );

const {
  protect,
} = require(
  "../../middleware/auth.middleware"
);

const router =
  express.Router();

/* =========================================================
   RATE LIMITER FACTORY
========================================================= */

const createLimiter = ({
  max,
  windowMs,
  message,
  skipSuccessfulRequests = false,
}) =>
  rateLimit({
    windowMs,
    max,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    skipSuccessfulRequests,

    /*
     Prevent one failed request from being
     counted multiple times.
    */
    requestWasSuccessful: (
      req,
      res
    ) =>
      res.statusCode < 400,

    handler: (
      req,
      res
    ) => {
      const retryAfter =
        res.getHeader(
          "Retry-After"
        );

      return res
        .status(429)
        .json({
          success: false,

          code:
            "TOO_MANY_ATTEMPTS",

          message,

          retryAfter:
            retryAfter
              ? Number(
                  retryAfter
                )
              : null,
        });
    },
  });

/* =========================================================
   RATE LIMITERS
========================================================= */

const registrationLimiter =
  createLimiter({
    max: 5,

    windowMs:
      60 *
      60 *
      1000,

    message:
      "Too many registration attempts. Please try again later.",
  });

const loginLimiter =
  createLimiter({
    max: 10,

    windowMs:
      15 *
      60 *
      1000,

    message:
      "Too many login attempts. Please try again later.",

    skipSuccessfulRequests:
      true,
  });

const googleLoginLimiter =
  createLimiter({
    max: 15,

    windowMs:
      15 *
      60 *
      1000,

    message:
      "Too many Google login attempts. Please try again later.",

    skipSuccessfulRequests:
      true,
  });

const emailVerificationLimiter =
  createLimiter({
    max: 10,

    windowMs:
      60 *
      60 *
      1000,

    message:
      "Too many email verification attempts. Please try again later.",
  });

const resendVerificationLimiter =
  createLimiter({
    max: 3,

    windowMs:
      60 *
      60 *
      1000,

    message:
      "Too many verification email requests. Please try again later.",
  });

const forgotPasswordLimiter =
  createLimiter({
    max: 5,

    windowMs:
      60 *
      60 *
      1000,

    message:
      "Too many password reset requests. Please try again later.",
  });

const resetPasswordLimiter =
  createLimiter({
    max: 5,

    windowMs:
      60 *
      60 *
      1000,

    message:
      "Too many password reset attempts. Please try again later.",
  });

const profileUpdateLimiter =
  createLimiter({
    max: 20,

    windowMs:
      15 *
      60 *
      1000,

    message:
      "Too many profile update attempts. Please try again later.",
  });

/* =========================================================
   REGISTRATION
========================================================= */

router.post(
  "/register",
  registrationLimiter,
  authController.register
);

/* =========================================================
   LOGIN
========================================================= */

router.post(
  "/login",
  loginLimiter,
  authController.login
);

router.post(
  "/google",
  googleLoginLimiter,
  authController.googleLogin
);

/* =========================================================
   EMAIL VERIFICATION
========================================================= */

router.get(
  "/verify-email/:token",
  emailVerificationLimiter,
  authController.verifyEmail
);

router.post(
  "/resend-verification",
  resendVerificationLimiter,
  authController.resendVerification
);

/* =========================================================
   PASSWORD RESET
========================================================= */

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  authController.forgotPassword
);

router.post(
  "/reset-password",
  resetPasswordLimiter,
  authController.resetPassword
);

router.post(
  "/reset-password/:token",
  resetPasswordLimiter,
  authController.resetPassword
);

/* =========================================================
   CURRENT USER
========================================================= */

router.get(
  "/me",
  protect,
  authController.me
);

router.patch(
  "/me",
  protect,
  profileUpdateLimiter,
  authController.updateProfile
);

/* =========================================================
   LOGOUT
========================================================= */

router.post(
  "/logout",
  protect,
  authController.logout
);

/* =========================================================
   EXPORT
========================================================= */

module.exports =
  router;