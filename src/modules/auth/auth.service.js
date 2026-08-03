const bcrypt =
  require("bcryptjs");

const crypto =
  require("crypto");

const jwt =
  require("jsonwebtoken");

const nodemailer =
  require("nodemailer");

const {
  OAuth2Client,
} = require(
  "google-auth-library"
);

const User =
  require("../../models/User");

const {
  ROLES,
  PUBLIC_SIGNUP_ROLES,
} = require(
  "../../config/roles"
);

const {
  normalizeRole,
  isBrandCreator,
} = require(
  "../../utils/accessControl"
);

const {
  PLANS,
} = require(
  "../../config/plans"
);



const sanitizeUser =
  require(
    "../../utils/sanitizeUser"
  );

/* =========================================================
   CONFIGURATION
========================================================= */

const BCRYPT_ROUNDS =
  Number(
    process.env
      .BCRYPT_ROUNDS ||
      12
  );

const JWT_EXPIRES_IN =
  process.env
    .JWT_EXPIRES_IN ||
  "7d";

const VERIFICATION_TOKEN_DURATION =
  Number(
    process.env
      .VERIFICATION_TOKEN_DURATION ||
      24 * 60 * 60 * 1000
  );

const RESET_TOKEN_DURATION =
  Number(
    process.env
      .RESET_TOKEN_DURATION ||
      60 * 60 * 1000
  );

/* =========================================================
   AUTH ERROR
========================================================= */

class AuthError extends Error {
  constructor(
    message,
    code,
    statusCode = 400
  ) {
    super(message);

    this.name =
      "AuthError";

    this.code =
      code;

    this.statusCode =
      statusCode;
  }
}

/* =========================================================
   AUTH SERVICE
========================================================= */

class AuthService {
  constructor() {
    this.transporter =
      null;

    this.googleClient =
      process.env
        .GOOGLE_CLIENT_ID
        ? new OAuth2Client(
            process.env
              .GOOGLE_CLIENT_ID
          )
        : null;
  }

  /* =======================================================
     JWT
  ======================================================= */

  generateToken(user) {
    const secret =
      String(
        process.env
          .JWT_SECRET ||
          ""
      ).trim();

    if (!secret) {
      throw new AuthError(
        "JWT_SECRET is missing",
        "JWT_CONFIGURATION_ERROR",
        500
      );
    }

    const role =
      normalizeRole(
        user.role
      );

    const isCreator =
      isBrandCreator(role);

    return jwt.sign(
      {
        id:
          user._id.toString(),

        userId:
          user._id.toString(),

        email:
          user.email,

        role,

        permissions:
          user.permissions || [],

        tokenVersion:
          Number(
            user.tokenVersion ||
              0
          ),

        accessType:
          "access",

        plan:
          isCreator
            ? user.plan ||
              PLANS.FREE
            : null,

        subscriptionStatus:
          isCreator
            ? user.subscriptionStatus
            : null,
      },
      secret,
      {
        expiresIn:
          JWT_EXPIRES_IN,

        algorithm:
          "HS256",

        issuer:
          process.env
            .JWT_ISSUER ||
          "twinn-api",

        audience:
          process.env
            .JWT_AUDIENCE ||
          "twinn-client",

        subject:
          user._id.toString(),
      }
    );
  }

  /* =======================================================
     TOKEN UTILITIES
  ======================================================= */

  generateRandomToken() {
    return crypto
      .randomBytes(32)
      .toString("hex");
  }

  hashToken(token) {
    if (!token) {
      throw new AuthError(
        "Token is required",
        "TOKEN_REQUIRED",
        400
      );
    }

    return crypto
      .createHash("sha256")
      .update(
        String(token)
      )
      .digest("hex");
  }

  /* =======================================================
     EMAIL TRANSPORTER
  ======================================================= */

  ensureEmailTransporter() {
    if (
      this.transporter
    ) {
      return this.transporter;
    }

    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
    } = process.env;

    if (
      !SMTP_HOST ||
      !SMTP_PORT ||
      !SMTP_USER ||
      !SMTP_PASS
    ) {
      return null;
    }

    this.transporter =
      nodemailer
        .createTransport({
          host:
            SMTP_HOST,

          port:
            Number(
              SMTP_PORT
            ),

          secure:
            Number(
              SMTP_PORT
            ) === 465,

          auth: {
            user:
              SMTP_USER,

            pass:
              SMTP_PASS,
          },
        });

    return this.transporter;
  }

  async sendEmail({
    to,
    subject,
    html,
  }) {
    const transporter =
      this.ensureEmailTransporter();

    if (!transporter) {
      console.warn(
        "Email transporter is not configured"
      );

      return false;
    }

    await transporter
      .sendMail({
        from:
          process.env
            .EMAIL_FROM ||
          process.env
            .SMTP_USER,

        to,

        subject,

        html,
      });

    return true;
  }

  /* =======================================================
     START FREE TRIAL
  ======================================================= */

  startCreatorTrial(user) {
    if (
      user.role !==
      ROLES.BRAND_CREATOR
    ) {
      return user;
    }

    if (
      typeof user.startFreeTrial ===
      "function"
    ) {
      user.startFreeTrial();

      return user;
    }

    /*
     Fallback in case the User model method
     has not yet been deployed.
    */

    const now =
      new Date();

    const expiresAt =
      new Date(
        now.getTime() +
          7 *
            24 *
            60 *
            60 *
            1000
      );

    user.plan =
      PLANS.FREE;

    user.trialPlan =
      PLANS.FREE;

    user.trialStartedAt =
      now;

    user.trialExpiresAt =
      expiresAt;

    user.planStartedAt =
      now;

    user.planExpiresAt =
      expiresAt;

    user.subscriptionStatus =
      "trialing";

    user.isTrialUsed =
      true;

    user.billingCycle =
      null;

    return user;
  }

  /* =======================================================
     EMAIL REGISTRATION
  ======================================================= */

 async signupWithEmail({
  email,
  password,
  name,
  phone,
  brand,
  role = ROLES.BRAND_CREATOR,
}) {
  const normalizedName =
  String(name || "")
    .trim();

const normalizedPhone =
  String(phone || "")
    .trim();

const normalizedBrand =
  String(brand || "")
    .trim();
    const normalizedEmail =
      String(email || "")
        .trim()
        .toLowerCase();

    const normalizedPassword =
      String(password || "");

    if (
      !normalizedEmail ||
      !normalizedPassword
    ) {
      throw new AuthError(
        "Email and password are required",
        "VALIDATION_ERROR",
        400
      );
    }

    if (
      normalizedPassword.length <
      8
    ) {
      throw new AuthError(
        "Password must contain at least 8 characters",
        "WEAK_PASSWORD",
        400
      );
    }

    const existing =
      await User.findOne({
        email:
          normalizedEmail,
      });

    if (existing) {
      throw new AuthError(
        "An account already exists with this email",
        "EMAIL_ALREADY_EXISTS",
        409
      );
    }

    /*
     Public registration can create only:
     - user
     - brandcreator

     Admin and manager must never be selectable
     through public signup.
    */

   const normalizedRole =
  normalizeRole(
    role
  );

if (
  !PUBLIC_SIGNUP_ROLES
    .includes(
      normalizedRole
    )
) {
  throw new AuthError(
    "Only Normal User and Brand Creator accounts can be created through public signup.",
    "INVALID_PUBLIC_SIGNUP_ROLE",
    400
  );
}

const safeRole =
  normalizedRole;

    const rawVerificationToken =
      this.generateRandomToken();

    const userData = {
  email: normalizedEmail,

  passwordHash: await bcrypt.hash(
    normalizedPassword,
    BCRYPT_ROUNDS
  ),

  role: safeRole,

  authProvider: "local",

  verificationToken: this.hashToken(
    rawVerificationToken
  ),

  verificationTokenExpiresAt: new Date(
    Date.now() + VERIFICATION_TOKEN_DURATION
  ),

  isVerified: false,
};

if (normalizedName) {
  userData.name = normalizedName;
}

if (normalizedPhone) {
  userData.phone = normalizedPhone;
}

if (normalizedBrand) {
  userData.brand = normalizedBrand;
}

const user = new User(userData);

    /*
     Brand creators receive the seven-day
     Free Trial automatically.
    */

    if (
      safeRole ===
      ROLES.BRAND_CREATOR
    ) {
      this.startCreatorTrial(
        user
      );
    }

    await user.save();

    const frontend =
      process.env
        .FRONTEND_URL ||
      "http://localhost:5173";

    let emailSent =
      false;

    try {
      emailSent =
        await this.sendEmail({
          to:
            user.email,

          subject:
            "Verify your Twinn account",

          html: `
            <div
              style="
                font-family: Arial, sans-serif;
                max-width: 560px;
                margin: auto;
                padding: 24px;
              "
            >
              <h2>Welcome to Twinn</h2>

              <p>
                Verify your email address to activate your account.
              </p>

              <p>
                <a
                  href="${frontend}/verify-email/${rawVerificationToken}"
                  style="
                    display: inline-block;
                    padding: 12px 20px;
                    background: #ec4899;
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 6px;
                  "
                >
                  Verify Email
                </a>
              </p>

              ${
                safeRole ===
                ROLES.BRAND_CREATOR
                  ? `
                    <p>
                      Your seven-day Free Trial has been created.
                    </p>
                  `
                  : ""
              }
            </div>
          `,
        });
    } catch (error) {
      console.error(
        "VERIFICATION EMAIL ERROR:",
        error.message
      );
    }

    return {
      user:
        sanitizeUser(user),

      emailSent,

      trial:
        safeRole ===
        ROLES.BRAND_CREATOR
          ? {
              active:
                user.isTrialActive,

              expiresAt:
                user.trialExpiresAt,

              daysRemaining:
                user.trialDaysRemaining,
            }
          : null,
    };
  }

  /* =======================================================
     EMAIL LOGIN
  ======================================================= */

  async loginWithEmail(
    email,
    password,
    ip = ""
  ) {
    const normalizedEmail =
      String(email || "")
        .trim()
        .toLowerCase();

    const user =
      await User
        .findOne({
          email:
            normalizedEmail,
        })
        .select(
          "+passwordHash +tokenVersion"
        );

    if (
      !user ||
      !user.passwordHash
    ) {
      throw new AuthError(
        "Invalid email or password",
        "INVALID_CREDENTIALS",
        401
      );
    }

    const matches =
      await bcrypt.compare(
        String(password || ""),
        user.passwordHash
      );

    if (!matches) {
      throw new AuthError(
        "Invalid email or password",
        "INVALID_CREDENTIALS",
        401
      );
    }

    if (!user.isVerified) {
      throw new AuthError(
        "Please verify your email before logging in",
        "EMAIL_NOT_VERIFIED",
        403
      );
    }

    if (
      user.isBlocked ||
      user.status !==
        "Active"
    ) {
      throw new AuthError(
        "Your account is blocked or inactive",
        "ACCOUNT_BLOCKED",
        403
      );
    }

    /*
     Save causes the User pre-validation hook
     to update expired trial/subscription status.
    */

    user.lastLogin =
      new Date();

    user.lastLoginIp =
      String(ip || "")
        .slice(0, 100);

    await user.save();

    return {
      token:
        this.generateToken(
          user
        ),

      user:
        sanitizeUser(user),
    };
  }

  /* =======================================================
     GOOGLE LOGIN
  ======================================================= */

 /* =======================================================
   GOOGLE AUTHENTICATION
======================================================= */

async googleLogin({
  idToken,
  requestedRole = "",
  mode = "login",
  ip = "",
}) {
  if (!idToken) {
    throw new AuthError(
      "Google ID token is required",
      "GOOGLE_TOKEN_REQUIRED",
      400
    );
  }

  if (
    !this.googleClient ||
    !process.env
      .GOOGLE_CLIENT_ID
  ) {
    throw new AuthError(
      "Google authentication is not configured",
      "GOOGLE_AUTH_NOT_CONFIGURED",
      500
    );
  }

  const normalizedMode =
    String(mode || "login")
      .trim()
      .toLowerCase();

  if (
    ![
      "signup",
      "login",
    ].includes(
      normalizedMode
    )
  ) {
    throw new AuthError(
      "Google authentication mode must be login or signup",
      "INVALID_GOOGLE_AUTH_MODE",
      400
    );
  }

  let ticket;

  try {
    ticket =
      await this.googleClient
        .verifyIdToken({
          idToken,

          audience:
            process.env
              .GOOGLE_CLIENT_ID,
        });
  } catch (error) {
    throw new AuthError(
      "Google token is invalid or expired",
      "INVALID_GOOGLE_TOKEN",
      401
    );
  }

  const payload =
    ticket.getPayload();

  if (
    !payload?.sub ||
    !payload?.email ||
    !payload.email_verified
  ) {
    throw new AuthError(
      "Google account email is not verified",
      "GOOGLE_EMAIL_NOT_VERIFIED",
      403
    );
  }

  const googleId =
    String(
      payload.sub
    ).trim();

  const email =
    String(
      payload.email
    )
      .trim()
      .toLowerCase();

  const normalizedRequestedRole =
    normalizeRole(
      requestedRole
    );

  const isValidPublicRole =
    normalizedRequestedRole ===
      ROLES.USER ||
    normalizedRequestedRole ===
      ROLES.BRAND_CREATOR;

  let user =
    await User
      .findOne({
        $or: [
          {
            googleId,
          },
          {
            email,
          },
        ],
      })
      .select(
        "+tokenVersion +passwordHash"
      );

  let isNewUser =
    false;

  /* =====================================================
     EXISTING ACCOUNT
  ===================================================== */

  if (user) {
    if (
      user.googleId &&
      user.googleId !==
        googleId
    ) {
      throw new AuthError(
        "This email is linked to another Google account",
        "GOOGLE_ACCOUNT_MISMATCH",
        409
      );
    }

    /*
     When the request comes from the signup page,
     prevent selecting a different role for an
     already registered email.
    */

    if (
      normalizedMode ===
        "signup" &&
      isValidPublicRole &&
      normalizeRole(
        user.role
      ) !==
        normalizedRequestedRole
    ) {
      throw new AuthError(
        `This Google email is already registered as ${user.role}. Please sign in using the existing account.`,
        "ACCOUNT_ROLE_MISMATCH",
        409
      );
    }

    /*
     Never update an existing user's role using
     the role received from the frontend.
    */

    if (!user.googleId) {
      user.googleId =
        googleId;
    }

    user.isVerified =
      true;

    user.verificationToken =
      null;

    user.verificationTokenExpiresAt =
      null;

    if (!user.avatarUrl) {
      user.avatarUrl =
        payload.picture ||
        "";
    }

    if (!user.name) {
      user.name =
        payload.name ||
        "";
    }
  } else {
    /* ===================================================
       NEW ACCOUNT
    =================================================== */

    if (
      normalizedMode !==
      "signup"
    ) {
      throw new AuthError(
        "No account exists for this Google email. Please create an account first.",
        "GOOGLE_ACCOUNT_NOT_REGISTERED",
        404
      );
    }

    if (!isValidPublicRole) {
      throw new AuthError(
        "Please select Brand Creator or Normal User before signing up with Google.",
        "GOOGLE_SIGNUP_ROLE_REQUIRED",
        400
      );
    }

    isNewUser =
      true;

    user =
      new User({
        email,

        name:
          payload.name ||
          "",

        avatarUrl:
          payload.picture ||
          "",

        googleId,

        isVerified:
          true,

        role:
          normalizedRequestedRole,
      });

    /*
     Only Brand Creators receive
     the free creator trial.
    */

    if (
      normalizedRequestedRole ===
      ROLES.BRAND_CREATOR
    ) {
      this.startCreatorTrial(
        user
      );
    }
  }

  if (
    user.isBlocked ||
    user.status !==
      "Active"
  ) {
    throw new AuthError(
      "Your account is blocked or inactive",
      "ACCOUNT_BLOCKED",
      403
    );
  }

  user.lastLogin =
    new Date();

  user.lastLoginIp =
    String(ip || "")
      .slice(0, 100);

  await user.save();

  return {
    token:
      this.generateToken(
        user
      ),

    user:
      sanitizeUser(
        user
      ),

    isNewUser,
  };
}

  /* =======================================================
     VERIFY EMAIL
  ======================================================= */

  async verifyEmail(token) {
    if (!token) {
      throw new AuthError(
        "Verification token is required",
        "VERIFICATION_TOKEN_REQUIRED",
        400
      );
    }

    const user =
      await User
        .findOne({
          verificationToken:
            this.hashToken(
              token
            ),

          verificationTokenExpiresAt:
            {
              $gt:
                new Date(),
            },
        })
        .select(
          "+verificationToken +verificationTokenExpiresAt"
        );

    if (!user) {
      throw new AuthError(
        "Verification token is invalid or expired",
        "INVALID_VERIFICATION_TOKEN",
        400
      );
    }

    if (
      user.isBlocked ||
      user.status !==
        "Active"
    ) {
      throw new AuthError(
        "Your account is blocked or inactive",
        "ACCOUNT_BLOCKED",
        403
      );
    }

    user.isVerified =
      true;

    user.verificationToken =
      null;

    user.verificationTokenExpiresAt =
      null;

    await user.save();

    return sanitizeUser(
      user
    );
  }

  /* =======================================================
     RESEND VERIFICATION
  ======================================================= */

  async resendVerificationEmail(
    email
  ) {
    const normalizedEmail =
      String(email || "")
        .trim()
        .toLowerCase();

    const user =
      await User.findOne({
        email:
          normalizedEmail,
      });

    /*
     Always return accepted to prevent
     email enumeration.
    */

    if (
      !user ||
      user.isVerified
    ) {
      return {
        accepted: true,
      };
    }

    if (
      user.isBlocked ||
      user.status !==
        "Active"
    ) {
      return {
        accepted: true,
      };
    }

    const rawToken =
      this.generateRandomToken();

    user.verificationToken =
      this.hashToken(
        rawToken
      );

    user.verificationTokenExpiresAt =
      new Date(
        Date.now() +
          VERIFICATION_TOKEN_DURATION
      );

    await user.save();

    const frontend =
      process.env
        .FRONTEND_URL ||
      "http://localhost:5173";

    try {
      await this.sendEmail({
        to:
          user.email,

        subject:
          "Verify your Twinn account",

        html: `
          <p>
            Click below to verify your Twinn account.
          </p>

          <p>
            <a href="${frontend}/verify-email/${rawToken}">
              Verify your email
            </a>
          </p>
        `,
      });
    } catch (error) {
      console.error(
        "RESEND EMAIL ERROR:",
        error.message
      );
    }

    return {
      accepted: true,
    };
  }

  /* =======================================================
     REQUEST PASSWORD RESET
  ======================================================= */

  async requestPasswordReset(
    email
  ) {
    const normalizedEmail =
      String(email || "")
        .trim()
        .toLowerCase();

    const user =
      await User.findOne({
        email:
          normalizedEmail,
      });

    /*
     Do not reveal whether an account exists.
    */

    if (
      !user ||
      !user.passwordHash ||
      user.isBlocked
    ) {
      return {
        accepted: true,
      };
    }

    const rawToken =
      this.generateRandomToken();

    user.resetToken =
      this.hashToken(
        rawToken
      );

    user.resetTokenExpiresAt =
      new Date(
        Date.now() +
          RESET_TOKEN_DURATION
      );

    await user.save();

    const frontend =
      process.env
        .FRONTEND_URL ||
      "http://localhost:5173";

    try {
      await this.sendEmail({
        to:
          user.email,

        subject:
          "Reset your Twinn password",

        html: `
          <p>
            A password reset was requested for your Twinn account.
          </p>

          <p>
            <a href="${frontend}/reset-password/${rawToken}">
              Reset your password
            </a>
          </p>

          <p>
            Ignore this email if you did not request a password reset.
          </p>
        `,
      });
    } catch (error) {
      console.error(
        "RESET EMAIL ERROR:",
        error.message
      );
    }

    return {
      accepted: true,
    };
  }

  /* =======================================================
     RESET PASSWORD
  ======================================================= */

  async resetPassword(
    token,
    newPassword
  ) {
    const password =
      String(
        newPassword || ""
      );

    if (
      password.length < 8
    ) {
      throw new AuthError(
        "Password must contain at least 8 characters",
        "WEAK_PASSWORD",
        400
      );
    }

    if (!token) {
      throw new AuthError(
        "Reset token is required",
        "RESET_TOKEN_REQUIRED",
        400
      );
    }

    const user =
      await User
        .findOne({
          resetToken:
            this.hashToken(
              token
            ),

          resetTokenExpiresAt:
            {
              $gt:
                new Date(),
            },
        })
        .select(
          "+resetToken +resetTokenExpiresAt +tokenVersion"
        );

    if (!user) {
      throw new AuthError(
        "Reset token is invalid or expired",
        "INVALID_RESET_TOKEN",
        400
      );
    }

    if (
      user.isBlocked ||
      user.status !==
        "Active"
    ) {
      throw new AuthError(
        "Your account is blocked or inactive",
        "ACCOUNT_BLOCKED",
        403
      );
    }

    user.passwordHash =
      await bcrypt.hash(
        password,
        BCRYPT_ROUNDS
      );

    user.resetToken =
      null;

    user.resetTokenExpiresAt =
      null;

    user.tokenVersion =
      Number(
        user.tokenVersion ||
          0
      ) + 1;

    await user.save();

    return {
      success: true,
    };
  }

  /* =======================================================
     UPDATE PROFILE
  ======================================================= */

  async updateProfile(
    userId,
    updates = {}
  ) {
    const allowedFields = [
      "name",
      "phone",
      "brand",
      "avatarUrl",
    ];

    const maximumLengths = {
      name: 100,
      phone: 30,
      brand: 150,
      avatarUrl: 2000,
    };

    const safeUpdates = {};

    allowedFields.forEach(
      (field) => {
        if (
          Object.prototype
            .hasOwnProperty.call(
              updates,
              field
            )
        ) {
          const value =
            String(
              updates[field] ??
                ""
            ).trim();

          if (
            value.length >
            maximumLengths[field]
          ) {
            throw new AuthError(
              `${field} is too long`,
              "VALIDATION_ERROR",
              400
            );
          }

          safeUpdates[field] =
            value;
        }
      }
    );

    if (
      Object.keys(
        safeUpdates
      ).length === 0
    ) {
      throw new AuthError(
        "No valid profile fields were provided",
        "NO_PROFILE_UPDATES",
        400
      );
    }

    const user =
      await User.findByIdAndUpdate(
        userId,
        {
          $set:
            safeUpdates,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!user) {
      throw new AuthError(
        "User account was not found",
        "USER_NOT_FOUND",
        404
      );
    }

    return sanitizeUser(
      user
    );
  }

  /* =======================================================
     VERIFY SMTP
  ======================================================= */

  async verifyEmailTransporter() {
    const transporter =
      this.ensureEmailTransporter();

    if (!transporter) {
      return false;
    }

    try {
      await transporter
        .verify();

      return true;
    } catch (error) {
      console.error(
        "SMTP VERIFY ERROR:",
        error.message
      );

      return false;
    }
  }
}

/* =========================================================
   EXPORT
========================================================= */

const authService =
  new AuthService();

authService.AuthError =
  AuthError;

module.exports =
  authService;