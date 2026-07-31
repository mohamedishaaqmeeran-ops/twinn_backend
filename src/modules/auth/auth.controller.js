const authService =
  require("./auth.service");

const sanitizeUser =
  require(
    "../../utils/sanitizeUser"
  );

/* =========================================================
   COOKIE CONFIGURATION
========================================================= */

const AUTH_COOKIE_NAME =
  process.env
    .AUTH_COOKIE_NAME ||
  "token";

const isProduction =
  process.env.NODE_ENV ===
  "production";

const getCookieOptions =
  () => ({
    httpOnly: true,

    secure:
      isProduction,

    sameSite:
      isProduction
        ? "none"
        : "lax",

    maxAge:
      Number(
        process.env
          .AUTH_COOKIE_MAX_AGE ||
          7 *
            24 *
            60 *
            60 *
            1000
      ),

    path: "/",
  });

/*
Do not pass maxAge while clearing.
Only cookie identity options must match.
*/

const getClearCookieOptions =
  () => ({
    httpOnly: true,

    secure:
      isProduction,

    sameSite:
      isProduction
        ? "none"
        : "lax",

    path: "/",
  });

/* =========================================================
   CLIENT IP
========================================================= */

const getClientIp = (
  req
) => {
  const forwarded =
    req.headers[
      "x-forwarded-for"
    ];

  if (
    Array.isArray(
      forwarded
    )
  ) {
    return String(
      forwarded[0] || ""
    )
      .trim()
      .slice(0, 100);
  }

  return String(
    forwarded ||
      req.socket
        ?.remoteAddress ||
      req.ip ||
      ""
  )
    .split(",")[0]
    .trim()
    .slice(0, 100);
};

/* =========================================================
   COOKIE HELPERS
========================================================= */

const setAuthCookie = (
  res,
  token
) => {
  res.cookie(
    AUTH_COOKIE_NAME,
    token,
    getCookieOptions()
  );
};

const clearAuthCookie = (
  res
) => {
  res.clearCookie(
    AUTH_COOKIE_NAME,
    getClearCookieOptions()
  );
};

/* =========================================================
   ERROR RESPONSE
========================================================= */

const sendError = (
  res,
  error
) => {
  const statusCode =
    Number(
      error?.statusCode
    ) || 500;

  const isKnownError =
    Boolean(
      error?.statusCode
    );

  console.error(
    "AUTH ERROR:",
    {
      name:
        error?.name,
      code:
        error?.code,
      message:
        error?.message,
      stack:
        process.env
            .NODE_ENV ===
          "development"
          ? error?.stack
          : undefined,
    }
  );

  return res
    .status(statusCode)
    .json({
      success: false,

      code:
        error?.code ||
        "INTERNAL_SERVER_ERROR",

      message:
        isKnownError
          ? error.message
          : "An internal server error occurred",
    });
};

/* =========================================================
   REGISTER
========================================================= */

exports.register = async (
  req,
  res
) => {
  try {
    const result =
      await authService
        .signupWithEmail({
          email:
            req.body.email,

          password:
            req.body.password,

          name:
            req.body.name,

          phone:
            req.body.phone,

          brand:
            req.body.brand,

          role:
            req.body.role,
        });

    return res
      .status(201)
      .json({
        success: true,

        message:
          result.emailSent
            ? "Registered successfully. Please verify your email."
            : "Registered successfully. Email delivery is currently unavailable; use resend verification later.",

        user:
          result.user,

        emailSent:
          Boolean(
            result.emailSent
          ),

        trial:
          result.trial ||
          null,
      });
  } catch (error) {
    return sendError(
      res,
      error
    );
  }
};

/* =========================================================
   EMAIL LOGIN
========================================================= */

/* =========================================================
   EMAIL LOGIN
========================================================= */

exports.login = async (
  req,
  res
) => {
  try {
    const {
      email,
      password,
    } = req.body || {};

    const result =
      await authService
        .loginWithEmail(
          email,
          password,
          getClientIp(req)
        );

    setAuthCookie(
      res,
      result.token
    );

    return res
      .status(200)
      .json({
        success: true,

        message:
          "Login successful",

        /*
         Cookie is preferred.

         accessToken is returned as a fallback
         when cross-site cookies are blocked.
        */
        accessToken:
          result.token,

        user:
          result.user,
      });
  } catch (error) {
    return sendError(
      res,
      error
    );
  }
};

/* =========================================================
   GOOGLE LOGIN
========================================================= */

/* =========================================================
   GOOGLE AUTHENTICATION
========================================================= */

/* =========================================================
   GOOGLE AUTHENTICATION
========================================================= */

exports.googleLogin = async (
  req,
  res
) => {
  try {
    const idToken =
      req.body?.idToken ||
      req.body?.credential ||
      req.body?.token;

    const requestedRole =
      String(
        req.body?.role || ""
      )
        .trim()
        .toLowerCase();

    const mode =
      String(
        req.body?.mode ||
          "login"
      )
        .trim()
        .toLowerCase();

    if (!idToken) {
      return res
        .status(400)
        .json({
          success: false,

          code:
            "GOOGLE_TOKEN_REQUIRED",

          message:
            "Google ID token is required",
        });
    }

    if (
      ![
        "login",
        "signup",
      ].includes(mode)
    ) {
      return res
        .status(400)
        .json({
          success: false,

          code:
            "INVALID_GOOGLE_AUTH_MODE",

          message:
            "Google authentication mode must be login or signup.",
        });
    }

    const result =
      await authService
        .googleLogin({
          idToken,

          requestedRole,

          mode,

          ip:
            getClientIp(req),
        });

    /*
     Set secure HttpOnly cookie.
    */
    setAuthCookie(
      res,
      result.token
    );

    return res
      .status(
        result.isNewUser
          ? 201
          : 200
      )
      .json({
        success: true,

        message:
          result.isNewUser
            ? "Google registration successful"
            : "Google login successful",

        isNewUser:
          Boolean(
            result.isNewUser
          ),

        /*
         Fallback for browsers that block the
         cross-site authentication cookie.
        */
        accessToken:
          result.token,

        user:
          result.user,
      });
  } catch (error) {
    return sendError(
      res,
      error
    );
  }
};

/* =========================================================
   VERIFY EMAIL
========================================================= */

exports.verifyEmail = async (
  req,
  res
) => {
  try {
    const token =
      req.params
        ?.token ||
      req.body
        ?.token;

    const user =
      await authService
        .verifyEmail(
          token
        );

    return res.json({
      success: true,

      message:
        "Email verified successfully",

      user,
    });
  } catch (error) {
    return sendError(
      res,
      error
    );
  }
};

/* =========================================================
   RESEND VERIFICATION
========================================================= */

exports.resendVerification =
  async (
    req,
    res
  ) => {
    try {
      await authService
        .resendVerificationEmail(
          req.body
            ?.email
        );

      return res.json({
        success: true,

        message:
          "If the account exists and is unverified, a verification email has been sent.",
      });
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  };

/* =========================================================
   FORGOT PASSWORD
========================================================= */

exports.forgotPassword =
  async (
    req,
    res
  ) => {
    try {
      await authService
        .requestPasswordReset(
          req.body
            ?.email
        );

      return res.json({
        success: true,

        message:
          "If the account exists, a password reset email has been sent.",
      });
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  };

/* =========================================================
   RESET PASSWORD
========================================================= */

exports.resetPassword =
  async (
    req,
    res
  ) => {
    try {
      const token =
        req.body
          ?.token ||
        req.params
          ?.token;

      const newPassword =
        req.body
          ?.newPassword ||
        req.body
          ?.password;

      await authService
        .resetPassword(
          token,
          newPassword
        );

      clearAuthCookie(
        res
      );

      return res.json({
        success: true,

        message:
          "Password reset successfully. Please log in again.",
      });
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  };

/* =========================================================
   LOGOUT
========================================================= */

/* =========================================================
   LOGOUT
========================================================= */

exports.logout = async (
  req,
  res
) => {
  try {
    /*
     Increase tokenVersion so every existing
     JWT belonging to this user becomes invalid.
    */

    if (req.user) {
      req.user.tokenVersion =
        Number(
          req.user.tokenVersion ||
            0
        ) + 1;

      await req.user.save({
        validateBeforeSave:
          false,
      });
    }

    clearAuthCookie(
      res
    );

    return res
      .status(200)
      .json({
        success: true,

        message:
          "Logged out successfully",
      });
  } catch (error) {
    console.error(
      "LOGOUT ERROR:",
      error
    );

    /*
     Always clear the browser cookie even when
     database token invalidation fails.
    */

    clearAuthCookie(
      res
    );

    return res
      .status(500)
      .json({
        success: false,

        code:
          "LOGOUT_FAILED",

        message:
          "Unable to complete logout",
      });
  }
};
/* =========================================================
   CURRENT USER
========================================================= */

exports.me = async (
  req,
  res
) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({
          success: false,

          code:
            "AUTHENTICATION_REQUIRED",

          message:
            "Please log in to continue",
        });
    }

    return res.json({
      success: true,

      user:
        sanitizeUser(
          req.user
        ),
    });
  } catch (error) {
    return sendError(
      res,
      error
    );
  }
};

/* =========================================================
   UPDATE PROFILE
========================================================= */

exports.updateProfile =
  async (
    req,
    res
  ) => {
    try {
      const userId =
        req.userId ||
        req.user
          ?._id ||
        req.user
          ?.id;

      if (!userId) {
        return res
          .status(401)
          .json({
            success: false,

            code:
              "AUTHENTICATION_REQUIRED",

            message:
              "Please log in to continue",
          });
      }

      const user =
        await authService
          .updateProfile(
            userId,
            req.body || {}
          );

      return res.json({
        success: true,

        message:
          "Profile updated successfully",

        user,
      });
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  };

/* =========================================================
   SMTP HEALTH CHECK
   Protect this route with admin middleware.
========================================================= */

exports.checkEmailConfiguration =
  async (
    req,
    res
  ) => {
    try {
      const configured =
        await authService
          .verifyEmailTransporter();

      return res
        .status(
          configured
            ? 200
            : 503
        )
        .json({
          success:
            configured,

          configured,

          message:
            configured
              ? "Email transporter is configured correctly"
              : "Email transporter is unavailable or incorrectly configured",
        });
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  };