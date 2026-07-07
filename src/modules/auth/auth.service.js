const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");

const User = require("../../models/User");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

class AuthService {
  generateToken(user) {
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role || "user",
        plan: user.plan || "free",
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );
  }

  safeUser(user) {
    return {
      id: user._id,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role || "user",
      plan: user.plan || "free",
      isVerified: user.isVerified,
    };
  }

  async sendVerificationEmail(user) {
    const verifyLink = `${process.env.FRONTEND_URL}/verify-email/${user.verificationToken}`;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: "Verify your Twinn account",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>Welcome to Twinn</h2>
          <p>Please verify your email to activate your account.</p>

          <a href="${verifyLink}"
             style="background:#ec4899;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;display:inline-block;font-weight:bold">
            Verify Email
          </a>

          <p>This link expires in 24 hours.</p>
          <p>If the button does not work, copy this link:</p>
          <p>${verifyLink}</p>
        </div>
      `,
    });
  }

  async signupWithEmail(email, password) {
    email = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.googleId) {
        throw new Error(
          "This email is linked to Google. Please login with Google."
        );
      }

      throw new Error("Email already registered.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const user = await User.create({
      email,
      passwordHash,
      verificationToken,
      verificationTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      role: email === "admin@aitwin.com" ? "admin" : "user",
      plan: "free",
      isVerified: false,
    });

    await this.sendVerificationEmail(user);

    return {
      user: this.safeUser(user),
    };
  }

  async loginWithEmail(email, password) {
    email = email.trim().toLowerCase();

    const user = await User.findOne({ email });

    if (!user || !user.passwordHash) {
      throw new Error("Invalid email or password.");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new Error("Invalid email or password.");
    }

    if (!user.isVerified) {
      throw new Error("Please verify your email before logging in.");
    }

    user.lastLogin = new Date();
    await user.save();

    return {
      user: this.safeUser(user),
      systemToken: this.generateToken(user),
    };
  }

  async verifyEmail(token) {
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      throw new Error("Verification link is invalid or expired.");
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiresAt = undefined;

    await user.save();

    return {
      message: "Email verified successfully.",
    };
  }

  async resendVerificationEmail(email) {
    email = email.trim().toLowerCase();

    const user = await User.findOne({ email });

    if (!user) {
      throw new Error("User not found.");
    }

    if (user.isVerified) {
      throw new Error("Email already verified.");
    }

    user.verificationToken = crypto.randomBytes(32).toString("hex");
    user.verificationTokenExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    );

    await user.save();
    await this.sendVerificationEmail(user);

    return {
      message: "Verification email sent.",
    };
  }

  async verifyAndAuthenticateGoogleUser(googleToken) {
    const ticket = await googleClient.verifyIdToken({
      idToken: googleToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const googleId = payload.sub;
    const email = payload.email?.trim().toLowerCase();

    if (!email) {
      throw new Error("Google email not found.");
    }

    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    if (!user) {
      user = await User.create({
        googleId,
        email,
        avatarUrl: payload.picture,
        role: "user",
        plan: "free",
        isVerified: true,
        lastLogin: new Date(),
      });
    } else {
      user.googleId = user.googleId || googleId;
      user.avatarUrl = payload.picture || user.avatarUrl;
      user.isVerified = true;
      user.lastLogin = new Date();
      await user.save();
    }

    return {
      user: this.safeUser(user),
      systemToken: this.generateToken(user),
    };
  }

  async verifyGoogleAccessToken(accessToken) {
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const payload = await response.json();

    if (!response.ok || !payload.email) {
      throw new Error("Invalid Google access token.");
    }

    const googleId = payload.sub;
    const email = payload.email.trim().toLowerCase();

    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    if (!user) {
      user = await User.create({
        googleId,
        email,
        avatarUrl: payload.picture,
        role: "user",
        plan: "free",
        isVerified: true,
        lastLogin: new Date(),
      });
    } else {
      user.googleId = user.googleId || googleId;
      user.avatarUrl = payload.picture || user.avatarUrl;
      user.isVerified = true;
      user.lastLogin = new Date();
      await user.save();
    }

    return {
      user: this.safeUser(user),
      systemToken: this.generateToken(user),
    };
  }

  async requestPasswordReset(email) {
    email = email.trim().toLowerCase();

    const user = await User.findOne({ email });

    if (!user) {
      return {
        message: "If that email exists, a reset link has been sent.",
      };
    }

    if (user.googleId && !user.passwordHash) {
      throw new Error("This account uses Google Login.");
    }

    user.resetToken = crypto.randomBytes(32).toString("hex");
    user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await user.save();

    return {
      message: "Password reset token generated.",
      resetToken: user.resetToken,
    };
  }

  async resetPassword(token, newPassword) {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      throw new Error("Reset link expired.");
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetToken = undefined;
    user.resetTokenExpiresAt = undefined;

    await user.save();

    return {
      message: "Password reset successful.",
    };
  }
}

module.exports = new AuthService();