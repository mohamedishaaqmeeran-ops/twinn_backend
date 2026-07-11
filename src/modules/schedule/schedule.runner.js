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
    (first, second) => {
      const firstIndex =
        PLATFORM_PRIORITY.indexOf(first);

      const secondIndex =
        PLATFORM_PRIORITY.indexOf(second);

      return firstIndex - secondIndex;
    }
  );
};

const updatePlatformResult = async (
  scheduleId,
  platform,
  update
) => {
  const schedule =
    await LiveSchedule.findById(
      scheduleId
    );

  if (!schedule) {
    return;
  }

  const result =
    schedule.platformResults.find(
      (item) =>
        item.platform === platform
    );

  if (!result) {
    schedule.platformResults.push({
      platform,
      ...update,
    });
  } else {
    Object.assign(result, update);
  }

  await schedule.save();
};

const startPlatform = async ({
  schedule,
  platform,
}) => {
  const commonCallbacks = {
    onStarted: async () => {
      await updatePlatformResult(
        schedule._id,
        platform,
        {
          status: "live",
          startedAt: new Date(),
          error: "",
        }
      );
    },

    onEnded: async () => {
      await updatePlatformResult(
        schedule._id,
        platform,
        {
          status: "completed",
          completedAt: new Date(),
        }
      );
    },

    onError: async (error) => {
      await updatePlatformResult(
        schedule._id,
        platform,
        {
          status: "failed",
          error: error.message,
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

        ...commonCallbacks,
      }
    );
  }

  if (platform === "facebook") {
    return liveService.startFacebookLive(
      schedule.userId,
      {
        videoPath:
          schedule.videoPath,

        title: schedule.title,

        description:
          schedule.description,

        ...commonCallbacks,
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
    await LiveSchedule.findById(
      scheduleId
    );

  if (!schedule) {
    throw new Error(
      "Schedule not found."
    );
  }

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

  // Runs Instagram first, then Facebook.
  for (
    const platform of prioritizedPlatforms
  ) {
    try {
      await updatePlatformResult(
        schedule._id,
        platform,
        {
          status: "starting",
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

      // Small delay before starting next platform.
      await new Promise((resolve) =>
        setTimeout(resolve, 3000)
      );
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
          error: error.message,
        }
      );

      results.push({
        platform,
        success: false,
        error: error.message,
      });
    }
  }

  const successfulResults =
    results.filter(
      (result) => result.success
    );

  schedule.status =
    successfulResults.length > 0
      ? "Live"
      : "Failed";

  schedule.startedAt =
    successfulResults.length > 0
      ? new Date()
      : undefined;

  schedule.lastError =
    successfulResults.length === 0
      ? results
          .map(
            (result) =>
              `${result.platform}: ${result.error}`
          )
          .join(" | ")
      : "";

  schedule.isProcessing = false;
  schedule.lockedAt = null;

  await schedule.save();

  if (
    successfulResults.length > 0 &&
    schedule.durationMinutes
  ) {
    const stopDelay =
      schedule.durationMinutes *
      60 *
      1000;

    setTimeout(async () => {
      try {
        await liveService.stopPlatforms(
          schedule.userId,
          successfulResults.map(
            (result) => result.platform
          )
        );

        await LiveSchedule.findByIdAndUpdate(
          schedule._id,
          {
            status: "Completed",
            completedAt: new Date(),
          }
        );
      } catch (error) {
        console.error(
          "AUTO STOP ERROR:",
          error
        );
      }
    }, stopDelay);
  }

  return results;
};