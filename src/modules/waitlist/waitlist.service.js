const crypto = require("crypto");
const mongoose = require("mongoose");

const Waitlist = require("../../models/Waitlist");

const generateReferralCode = () => {
  return crypto.randomBytes(5).toString("hex").toUpperCase();
};

exports.createWaitlistUser = async ({
  fullName,
  email,
  mobile,
  brand,
  referredBy,
}) => {
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await Waitlist.findOne({
    email: normalizedEmail,
  });

  if (existingUser) {
    throw new Error("This email is already registered on the waitlist.");
  }

  let referralCode = generateReferralCode();

  while (await Waitlist.exists({ referralCode })) {
    referralCode = generateReferralCode();
  }

  const user = await Waitlist.create({
    fullName: fullName.trim(),
    email: normalizedEmail,
    mobile: mobile.trim(),
    brand: brand.trim(),
    referralCode,
    referredBy: referredBy?.trim() || null,
  });

  if (referredBy) {
    await Waitlist.findOneAndUpdate(
      { referralCode: referredBy.trim().toUpperCase() },
      {
        $inc: {
          referralCount: 1,
        },
      }
    );
  }

  return user;
};

exports.getWaitlistUsers = async ({
  search = "",
  status = "",
  page = 1,
  limit = 50,
}) => {
  const filter = {};

  if (status && status !== "all") {
    filter.status = status;
  }

  if (search.trim()) {
    const expression = new RegExp(search.trim(), "i");

    filter.$or = [
      { fullName: expression },
      { email: expression },
      { mobile: expression },
      { brand: expression },
      { referralCode: expression },
    ];
  }

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const [users, total] = await Promise.all([
    Waitlist.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit),
    Waitlist.countDocuments(filter),
  ]);

  return {
    users,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit),
  };
};

exports.getWaitlistUserById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid waitlist user ID.");
  }

  return Waitlist.findById(id);
};

exports.getWaitlistCount = async () => {
  return Waitlist.countDocuments();
};

exports.updateWaitlistUser = async (id, updates) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid waitlist user ID.");
  }

  const allowedUpdates = {};

  if (updates.fullName !== undefined) {
    allowedUpdates.fullName = updates.fullName.trim();
  }

  if (updates.email !== undefined) {
    const normalizedEmail = updates.email.trim().toLowerCase();

    const existingUser = await Waitlist.findOne({
      email: normalizedEmail,
      _id: { $ne: id },
    });

    if (existingUser) {
      throw new Error("This email is already registered.");
    }

    allowedUpdates.email = normalizedEmail;
  }

  if (updates.mobile !== undefined) {
    allowedUpdates.mobile = updates.mobile.trim();
  }

  if (updates.brand !== undefined) {
    allowedUpdates.brand = updates.brand.trim();
  }

  if (updates.status !== undefined) {
    const allowedStatuses = [
      "waiting",
      "contacted",
      "converted",
      "rejected",
    ];

    if (!allowedStatuses.includes(updates.status)) {
      throw new Error("Invalid waitlist status.");
    }

    allowedUpdates.status = updates.status;
  }

  if (updates.notes !== undefined) {
    allowedUpdates.notes = updates.notes.trim();
  }

  return Waitlist.findByIdAndUpdate(
    id,
    {
      $set: allowedUpdates,
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

exports.deleteWaitlistUser = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid waitlist user ID.");
  }

  return Waitlist.findByIdAndDelete(id);
};