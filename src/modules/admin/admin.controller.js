const User = require("../../models/User");
const Waitlist = require("../../models/Waitlist");

exports.getUsers = async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });

  res.json({
    success: true,
    users,
  });
};


exports.getWaitlist = async (req, res) => {
  const waitlist = await Waitlist.find().sort({
    createdAt: -1,
  });

  res.json({
    success: true,
    waitlist,
  });
};


exports.updateUser = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );

  res.json({
    success: true,
    user,
  });
};



exports.blockUser = async (req, res) => {
  const user = await User.findById(req.params.id);

  user.status =
    user.status === "Blocked"
      ? "Active"
      : "Blocked";

  await user.save();

  res.json({
    success: true,
    user,
  });
};


exports.deleteUser = async (req, res) => {
  await User.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
  });
};