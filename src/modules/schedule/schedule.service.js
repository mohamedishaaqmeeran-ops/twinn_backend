const LiveSchedule = require("../../models/LiveSchedule");
const Connection = require("../../models/Connection");
const Product = require("../../models/Product");

const SUPPORTED_PLATFORMS = [
  "instagram",
  "facebook",
  "youtube",
  "tiktok",
];

const PLATFORM_PRIORITY = [
  "instagram",
  "facebook",
  "youtube",
  "tiktok",
];

const normalizePlatforms = (platforms = []) => {
  const list = Array.isArray(platforms)
    ? platforms
    : [platforms];

  const uniquePlatforms = [
    ...new Set(
      list
        .map((platform) =>
          String(platform || "")
            .trim()
            .toLowerCase()
        )
        .filter((platform) =>
          SUPPORTED_PLATFORMS.includes(platform)
        )
    ),
  ];

  return uniquePlatforms.sort(
    (first, second) =>
      PLATFORM_PRIORITY.indexOf(first) -
      PLATFORM_PRIORITY.indexOf(second)
  );
};

exports.createSchedule = async ({
  user,
  payload,
}) => {
  if (!user?.id) {
    throw new Error("Authenticated user is required.");
  }

  const {
  title,
  description,
  productId,
  videoPath,
  platforms,
  scheduledAt,
  timezone,
  durationMinutes,
  instagramRtmpUrl,
  instagramStreamKey,
} = payload;

  if (!title?.trim()) {
    throw new Error("Schedule title is required.");
  }

  if (!productId) {
    throw new Error("Product is required.");
  }

  if (!videoPath?.trim()) {
    throw new Error("Please upload a live video.");
  }

  if (!scheduledAt) {
    throw new Error(
      "Scheduled date and time are required."
    );
  }

  const scheduleDate = new Date(scheduledAt);

  if (Number.isNaN(scheduleDate.getTime())) {
    throw new Error("Invalid scheduled date.");
  }

  if (scheduleDate.getTime() <= Date.now()) {
    throw new Error(
      "Scheduled time must be in the future."
    );
  }

  const normalizedPlatforms =
    normalizePlatforms(platforms);

  if (!normalizedPlatforms.length) {
    throw new Error(
      "Select at least one supported platform."
    );
  }

  const plan = String(
    user.plan || "free"
  ).toLowerCase();

  const isPaidPlan = [
    "pro",
    "business",
    "agency",
  ].includes(plan);

  const maxSchedules = isPaidPlan ? 50 : 1;
  const maxPlatforms = isPaidPlan ? 4 : 1;

  if (
    normalizedPlatforms.length > maxPlatforms
  ) {
    throw new Error(
      `Your ${plan} plan supports only ${maxPlatforms} platform(s) per schedule.`
    );
  }

  const duration = Number(durationMinutes) || 30;

  if (
    !Number.isFinite(duration) ||
    duration < 1 ||
    duration > 480
  ) {
    throw new Error(
      "Duration must be between 1 and 480 minutes."
    );
  }

  const selectedProduct = await Product.findOne({
    _id: productId,
    userId: user.id,
    status: {
      $ne: "inactive",
    },
  });

  if (!selectedProduct) {
    throw new Error(
      "Product not found or you do not have permission to use it."
    );
  }

  const existingCount =
    await LiveSchedule.countDocuments({
      userId: user.id,
      status: {
        $in: [
          "Upcoming",
          "Starting",
          "Live",
        ],
      },
    });

  if (existingCount >= maxSchedules) {
    throw new Error(
      `Your ${plan} plan supports only ${maxSchedules} active schedule(s).`
    );
  }

  const connections = await Connection.find({
    userId: user.id,
    platform: {
      $in: normalizedPlatforms,
    },
    connected: true,
  }).select(
    "+instagramStreamKey +youtubeStreamKey +pageAccessToken"
  );

  const connectedPlatformSet = new Set(
    connections.map((connection) =>
      String(connection.platform).toLowerCase()
    )
  );

  const missingConnections =
    normalizedPlatforms.filter(
      (platform) =>
        !connectedPlatformSet.has(platform)
    );

  if (missingConnections.length) {
    throw new Error(
      `Connect these platforms first: ${missingConnections.join(
        ", "
      )}`
    );
  }

  if (normalizedPlatforms.includes("instagram")) {
  const normalizedRtmpUrl = String(
    instagramRtmpUrl || ""
  ).trim();

  const normalizedStreamKey = String(
    instagramStreamKey || ""
  ).trim();

  if (!normalizedRtmpUrl) {
    throw new Error(
      "Instagram RTMP URL is required for this schedule."
    );
  }

  if (!normalizedStreamKey) {
    throw new Error(
      "Instagram stream key is required for this schedule."
    );
  }

  if (
    !normalizedRtmpUrl.startsWith("rtmp://") &&
    !normalizedRtmpUrl.startsWith("rtmps://")
  ) {
    throw new Error(
      "Instagram RTMP URL must start with rtmp:// or rtmps://."
    );
  }
}

  if (
    normalizedPlatforms.includes("facebook")
  ) {
    const facebookConnection =
      connections.find(
        (connection) =>
          connection.platform === "facebook"
      );

    if (
      !facebookConnection?.pageId ||
      !facebookConnection?.pageAccessToken
    ) {
      throw new Error(
        "A connected Facebook Page is required before scheduling Facebook Live."
      );
    }
  }

  const platformResults =
    normalizedPlatforms.map((platform) => ({
      platform,
      status: "pending",
    }));

  return LiveSchedule.create({
  userId: user.id,

  title: title.trim(),

  description:
    description?.trim() || "",

  productId: selectedProduct._id,
  product: selectedProduct.name,
  productName: selectedProduct.name,

  videoPath: videoPath.trim(),

  instagramRtmpUrl:
    normalizedPlatforms.includes("instagram")
      ? String(instagramRtmpUrl).trim().replace(/\/+$/, "")
      : "",

  instagramStreamKey:
    normalizedPlatforms.includes("instagram")
      ? String(instagramStreamKey).trim().replace(/^\/+/, "")
      : "",

  platforms: normalizedPlatforms,

  scheduledAt: scheduleDate,

  endsAt: new Date(
    scheduleDate.getTime() +
      duration * 60 * 1000
  ),

  timezone:
    timezone || "Asia/Kolkata",

  durationMinutes: duration,

  status: "Upcoming",

  platformResults,
});
};

exports.getSchedules = async (userId) => {
  return LiveSchedule.find({
    userId,
  })
    .populate(
      "productId",
      "name price salePrice images status"
    )
    .sort({
      scheduledAt: 1,
    })
    .lean();
};

exports.getSchedule = async ({
  userId,
  scheduleId,
}) => {
  const schedule =
    await LiveSchedule.findOne({
      _id: scheduleId,
      userId,
    }).populate(
      "productId",
      "name price salePrice images status"
    );

  if (!schedule) {
    throw new Error("Schedule not found.");
  }

  return schedule;
};

exports.cancelSchedule = async ({
  userId,
  scheduleId,
}) => {
  const schedule =
    await LiveSchedule.findOne({
      _id: scheduleId,
      userId,
    });

  if (!schedule) {
    throw new Error("Schedule not found.");
  }

  if (
    ["Starting", "Live", "Completed"].includes(
      schedule.status
    )
  ) {
    throw new Error(
      `A ${schedule.status.toLowerCase()} schedule cannot be cancelled.`
    );
  }

  schedule.status = "Cancelled";
  schedule.isProcessing = false;
  schedule.lockedAt = null;

  await schedule.save();

  return schedule;
};

exports.deleteSchedule = async ({
  userId,
  scheduleId,
}) => {
  const schedule =
    await LiveSchedule.findOne({
      _id: scheduleId,
      userId,
    });

  if (!schedule) {
    throw new Error("Schedule not found.");
  }

  if (
    ["Starting", "Live"].includes(schedule.status)
  ) {
    throw new Error(
      "Stop the live session before deleting it."
    );
  }

  await schedule.deleteOne();

  return true;
};

exports.normalizePlatforms =
  normalizePlatforms;