const authService = require("./auth.service");
const User = require("../../models/User");

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 24 * 60 * 60 * 1000,
};

exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const { user } = await authService.signupWithEmail(email, password);

    res.status(201).json({
      success: true,
      message:
        "Registered successfully. Please verify your email before login.",
      user,
    });
  } catch (error) {
    console.log("REGISTER ERROR:", error.message);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { user, systemToken } = await authService.loginWithEmail(
      email,
      password
    );

    res.cookie("token", systemToken, cookieOptions);

    res.json({
      success: true,
      message: "Login successful",
      token: systemToken,
      user,
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.message,
    });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
    }

    const { user, systemToken } =
      await authService.verifyAndAuthenticateGoogleUser(credential);

    res.cookie("token", systemToken, cookieOptions);

    res.json({
      success: true,
      message: "Google login successful",
      token: systemToken,
      user,
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Google login failed",
    });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const result = await authService.verifyEmail(token);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    const result = await authService.resendVerificationEmail(email);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.me = async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
};

exports.logout = async (req, res) => {
  res.clearCookie("token");

  res.json({
    success: true,
    message: "Logged out successfully",
  });
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const result = await authService.requestPasswordReset(email);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const result = await authService.resetPassword(token, newPassword);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select(
      "-passwordHash -verificationToken -resetToken"
    );

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};