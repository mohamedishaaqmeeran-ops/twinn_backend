const Waitlist = require("../../models/Waitlist");

exports.createWaitlistUser = async ({ fullName, email, mobile, brand }) => {
  email = email.trim().toLowerCase();

  const existingUser = await Waitlist.findOne({ email });

  if (existingUser) {
    throw new Error("Email already registered");
  }

  return Waitlist.create({
    fullName,
    email,
    mobile,
    brand
  });
};

exports.getWaitlistUsers = async () => {
  return Waitlist.find().sort({ createdAt: -1 });
};

exports.getWaitlistCount = async () => {
  return Waitlist.countDocuments();
};