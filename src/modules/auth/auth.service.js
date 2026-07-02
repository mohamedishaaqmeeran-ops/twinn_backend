const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

const User = require("../../models/User");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

class AuthService {
  generateToken(user) {
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role || "user",
        plan: user.plan || "free"
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d"
      }
    );
  }

  safeUser(user) {
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
      avatarUrl: user.avatarUrl,
      role: user.role || "user",
      plan: user.plan || "free"
    };
  }

  async signupWithEmail(email, password, name, mobileNumber) {
    email = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.googleId) {
        throw new Error(
          "This email is linked to Google. Please login with Google."
        );
      }

      throw new Error("Account already exists.");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const role = email === "admin@aitwin.com" ? "admin" : "user";

    const user = await User.create({
      name,
      email,
      mobileNumber,
      passwordHash,
      role,
      plan: "free",
      isVerified: true
    });

    const systemToken = this.generateToken(user);

    return {
      user: this.safeUser(user),
      systemToken
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

    user.lastLogin = new Date();
    await user.save();

    const systemToken = this.generateToken(user);

    return {
      user: this.safeUser(user),
      systemToken
    };
  }

  async verifyAndAuthenticateGoogleUser(googleToken) {
    const ticket = await googleClient.verifyIdToken({
      idToken: googleToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name;
    const avatarUrl = payload.picture;

    let user = await User.findOne({
      $or: [{ googleId }, { email }]
    });

    if (!user) {
      user = await User.create({
        googleId,
        email,
        name,
        avatarUrl,
        isVerified: true,
        role: "user",
        plan: "free",
        lastLogin: new Date()
      });
    } else {
      user.googleId = user.googleId || googleId;
      user.name = name || user.name;
      user.avatarUrl = avatarUrl || user.avatarUrl;
      user.isVerified = true;
      user.lastLogin = new Date();

      await user.save();
    }

    const systemToken = this.generateToken(user);

    return {
      user: this.safeUser(user),
      systemToken
    };
  }

  async requestPasswordReset(email) {
    email = email.trim().toLowerCase();

    const user = await User.findOne({ email });

    if (!user) {
      return {
        message: "If that email exists, a reset link has been sent."
      };
    }

    if (user.googleId) {
      throw new Error(
        "This account uses Google Login. You cannot reset password here."
      );
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetToken = resetToken;
    user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await user.save();

    return {
      message: "Reset token generated successfully.",
      resetToken
    };
  }

  async resetPassword(token, newPassword) {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      throw new Error("Reset link is invalid or expired.");
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetToken = undefined;
    user.resetTokenExpiresAt = undefined;

    await user.save();

    return {
      message: "Password reset successful."
    };
  }
}

module.exports = new AuthService();