const authService = require("./auth.service");
const User = require("../../models/User");

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 24 * 60 * 60 * 1000
};

exports.register = async (req, res) => {
  console.log("===== REGISTER API HIT =====");
  console.log("BODY:", req.body);

  try {
    const { name, email, password, mobileNumber } = req.body;

    if (!name || !email || !password || !mobileNumber) {
      return res.status(400).json({
        success: false,
        message: "Name, email, mobile number and password are required"
      });
    }

    const { user, systemToken } = await authService.signupWithEmail(
      email,
      password,
      name,
      mobileNumber
    );

    console.log("USER SAVED:", user);

    res.cookie("token", systemToken, cookieOptions);

    res.status(201).json({
      success: true,
      message: "Registered successfully",
      token: systemToken,
      user
    });
  } catch (error) {
    console.log("REGISTER ERROR:", error.message);

    res.status(400).json({
      success: false,
      message: error.message
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
      user
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.message
    });
  }
};

exports.googleLogin = async (req, res) => {
  console.log("GOOGLE BODY:", req.body);

  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required"
      });
    }

    const { user, systemToken } =
      await authService.verifyAndAuthenticateGoogleUser(credential);

    res.cookie("token", systemToken, cookieOptions);

    res.json({
      success: true,
      message: "Google login successful",
      token: systemToken,
      user
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Google login failed"
    });
  }
};

exports.me = async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
};

exports.logout = async (req, res) => {
  res.clearCookie("token");

  res.json({
    success: true,
    message: "Logged out successfully"
  });
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const result = await authService.requestPasswordReset(email);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const result = await authService.resetPassword(token, newPassword);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-passwordHash");

    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};