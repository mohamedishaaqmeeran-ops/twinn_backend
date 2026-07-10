const Waitlist = require("../../models/Waitlist");

exports.createWaitlistUser = async ({
  fullName,
  email,
  mobile,
  brand,
}) => {
  const existingUser = await Waitlist.findOne({
    email,
  });

  if (existingUser) {
    throw new Error("This email is already registered in the waitlist");
  }

  return Waitlist.create({
    fullName,
    email,
    mobile,
    brand,
  });
};

exports.getWaitlistUsers = async () => {
  return Waitlist.find().sort({
    createdAt: -1,
  });
};

exports.getWaitlistCount = async () => {
  return Waitlist.countDocuments();
};

exports.deleteWaitlistUser = async (id) => {
  return Waitlist.findByIdAndDelete(id);
};