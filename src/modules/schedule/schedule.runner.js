const LiveSchedule =
  require("../../models/LiveSchedule");

const liveService =
  require("../live/live.service");

const PLATFORM_PRIORITY = [
  "instagram",
  "facebook",
  "youtube",
  "tiktok",
];

const sortPlatformsByPriority = (
  platforms = []
) => {
  return [...platforms].sort(
    (first, second) =>
      PLATFORM_PRIORITY.indexOf(first) -
      PLATFORM_PRIORITY.indexOf(second)
  );
};

const updatePlatformResult = async (
  scheduleId,
  platform,
  update
) => {
  const schedule =
    await LiveSchedule.findById(scheduleId);

  if (!schedule) {
    return;
  }

  const result =
    schedule.platformResults.find(
      (item) =>
        item.platform === platform
    );

  if (result) {
    Object.assign(result, update);
  } else {
    schedule.platformResults.push({
      platform,
      ...update,
    });
  }

  await schedule.save();
};

const safeUpdatePlatformResult = (
  scheduleId,
  platform,
  update
) => {
  updatePlatformResult(
    scheduleId,
    platform,
    update
  ).catch((error) => {
    console.error(
      `UPDATE ${platform} RESULT ERROR:`,
      error
    );
  });
};

const startPlatform = async ({
  schedule,
  platform,
}) => {
  const callbacks = {
    onStarted: () => {
      safeUpdatePlatformResult(
        schedule._id,
        platform,
        {
          status: "live",
          startedAt: new Date(),
          completedAt: null,
          error: "",
        }
      );
    },

    onEnded: ({ code } = {}) => {
      const completed =
        code === 0 ||
        code === null;

      safeUpdatePlatformResult(
        schedule._id,
        platform,
        {
          status: completed
            ? "completed"
            : "failed",

          completedAt: new Date(),

          error: completed
            ? ""
            : `FFmpeg exited with code ${code}`,
        }
      );
    },

    onError: (error) => {
      safeUpdatePlatformResult(
        schedule._id,
        platform,
        {
          status: "failed",
          completedAt: new Date(),

          error:
            error?.message ||
            "Streaming process failed.",
        }
      );
    },
  };

  if (platform === "instagram") {
    return liveService.startInstagramLive(
      schedule.userId,
      {
        videoPath:
          schedule.videoPath,

        rtmpUrl:
          schedule.instagramRtmpUrl,

        streamKey:
          schedule.instagramStreamKey,

        ...callbacks,
      }
    );
  }

  if (platform === "facebook") {
    return liveService.startFacebookLive(
      schedule.userId,
      {
        videoPath:
          schedule.videoPath,

        title:
          schedule.title,

        description:
          schedule.description,

        ...callbacks,
      }
    );
  }

  if (platform === "youtube") {
    throw new Error(
      "YouTube Live is not implemented yet."
    );
  }

  if (platform === "tiktok") {
    throw new Error(
      "TikTok Live is not implemented yet."
    );
  }

  throw new Error(
    `Unsupported platform: ${platform}`
  );
};

exports.runSchedule = async (
  scheduleId
) => {
  const schedule =
    await LiveSchedule.findById(scheduleId)
      .select(
        "+instagramRtmpUrl +instagramStreamKey"
      );

  if (!schedule) {
    throw new Error(
      "Schedule not found."
    );
  }

  console.log("SCHEDULE RTMP CHECK:", {
    scheduleId:
      String(schedule._id),

    hasRtmpUrl:
      Boolean(
        schedule.instagramRtmpUrl
      ),

    hasStreamKey:
      Boolean(
        schedule.instagramStreamKey
      ),

    platforms:
      schedule.platforms,
  });

  if (
    schedule.status !== "Starting"
  ) {
    throw new Error(
      `Schedule status is ${schedule.status}.`
    );
  }

  const prioritizedPlatforms =
    sortPlatformsByPriority(
      schedule.platforms
    );

  const results = [];

  for (
    const platform of prioritizedPlatforms
  ) {
    try {
      await updatePlatformResult(
        schedule._id,
        platform,
        {
          status: "starting",
          startedAt: null,
          completedAt: null,
          error: "",
        }
      );

      const result =
        await startPlatform({
          schedule,
          platform,
        });

      results.push({
        platform,
        success: true,
        data: result,
      });

      await new Promise((resolve) => {
        setTimeout(resolve, 3000);
      });
    } catch (error) {
      console.error(
        `SCHEDULE ${schedule._id} ${platform} ERROR:`,
        error
      );

      await updatePlatformResult(
        schedule._id,
        platform,
        {
          status: "failed",
          completedAt: new Date(),
          error:
            error.message ||
            "Unable to start stream.",
        }
      );

      results.push({
        platform,
        success: false,
        error:
          error.message ||
          "Unable to start stream.",
      });
    }
  }

  const successfulResults =
    results.filter(
      (result) => result.success
    );

  const freshSchedule =
    await LiveSchedule.findById(
      schedule._id
    );

  if (!freshSchedule) {
    return results;
  }

  freshSchedule.status =
    successfulResults.length > 0
      ? "Live"
      : "Failed";

  freshSchedule.startedAt =
    successfulResults.length > 0
      ? new Date()
      : null;

  freshSchedule.lastError =
    results
      .filter(
        (result) =>
          !result.success
      )
      .map(
        (result) =>
          `${result.platform}: ${result.error}`
      )
      .join(" | ");

  freshSchedule.isProcessing = false;
  freshSchedule.lockedAt = null;

  await freshSchedule.save();

  return results;
};