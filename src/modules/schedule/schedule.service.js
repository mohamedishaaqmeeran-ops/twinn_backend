const LiveSchedule = require("../../models/LiveSchedule");
const Connection = require("../../models/Connection");

const SUPPORTED_PLATFORMS = [
  "instagram",
  "facebook",
  "youtube",
  "tiktok",
];

const normalizePlatforms = (platforms = []) => {
  const list = Array.isArray(platforms)
    ? platforms
    : [platforms];

  return [
    ...new Set(
      list
        .map((platform) =>
          String(platform).trim().toLowerCase()
        )
        .filter((platform) =>
          SUPPORTED_PLATFORMS.includes(platform)
        )
    ),
  ];
};

exports.createSchedule = async ({
  user,
  payload,
}) => {
  const {
    title,
    description,
    productId,
    product,
    productName,
    videoPath,
    platforms,
    scheduledAt,
    timezone,
    durationMinutes,
  } = payload;

  if (!title?.trim()) {
    throw new Error("Schedule title is required.");
  }

  if (!videoPath?.trim()) {
    throw new Error(
      "A video path or video URL is required."
    );
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
    user?.plan || "free"
  ).toLowerCase();

  const isPaidPlan =
    plan === "pro" ||
    plan === "business" ||
    plan === "agency";

  const maxSchedules = isPaidPlan ? 50 : 1;
  const maxPlatforms = isPaidPlan ? 4 : 1;

  if (
    normalizedPlatforms.length > maxPlatforms
  ) {
    throw new Error(
      `Your ${plan} plan supports only ${maxPlatforms} platform(s) per schedule.`
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
  }).select("+instagramStreamKey +youtubeStreamKey");

  const connectedPlatforms = new Set(
    connections.map((connection) =>
      connection.platform.toLowerCase()
    )
  );

  const missingConnections =
    normalizedPlatforms.filter(
      (platform) =>
        !connectedPlatforms.has(platform)
    );

  if (missingConnections.length) {
    throw new Error(
      `Connect these platforms first: ${missingConnections.join(
        ", "
      )}`
    );
  }

  if (
    normalizedPlatforms.includes("instagram")
  ) {
    const instagramConnection =
      connections.find(
        (connection) =>
          connection.platform === "instagram"
      );

    if (
      !instagramConnection?.instagramRtmpUrl ||
      !instagramConnection?.instagramStreamKey
    ) {
      throw new Error(
        "Instagram RTMP URL and stream key are required before scheduling Instagram Live."
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

    productId: productId || null,
    product: product || "",
    productName: productName || "",

    videoPath: videoPath.trim(),

    platforms: normalizedPlatforms,

    scheduledAt: scheduleDate,

    timezone:
      timezone || "Asia/Kolkata",

    durationMinutes:
      Number(durationMinutes) || 30,

    status: "Upcoming",

    platformResults,
  });
};

exports.getSchedules = async (userId) => {
  return LiveSchedule.find({
    userId,
  })
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
    });

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
    ["Live", "Completed"].includes(
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

  if (schedule.status === "Live") {
    throw new Error(
      "Stop the live session before deleting it."
    );
  }

  await schedule.deleteOne();

  return true;
};

exports.normalizePlatforms =
  normalizePlatforms;