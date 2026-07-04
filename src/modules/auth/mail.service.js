const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.sendMail = async ({ to, subject, html }) => {
  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
};

exports.sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;

  return exports.sendMail({
    to: email,
    subject: "Verify your Twinn account",
    html: `
      <h2>Welcome to Twinn</h2>
      <p>Please verify your email to activate your account.</p>
      <a href="${verifyUrl}" style="background:#ec4899;color:white;padding:12px 20px;text-decoration:none;border-radius:5px;">
        Verify Email
      </a>
      <p>This link expires in 24 hours.</p>
    `,
  });
};