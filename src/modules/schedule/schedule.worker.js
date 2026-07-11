const cron = require("node-cron");

const LiveSchedule = require("../../models/LiveSchedule");
const scheduleRunner = require("./schedule.runner");
const liveService = require("../live/live.service");

let workerStarted = false;
let workerRunning = false;

const releaseExpiredLocks = async () => {
  const lockExpiry = new Date(
    Date.now() - 10 * 60 * 1000
  );

  await LiveSchedule.updateMany(
    {
      status: "Starting",
      isProcessing: true,
      lockedAt: {
        $lt: lockExpiry,
      },
    },
    {
      $set: {
        status: "Upcoming",
        isProcessing: false,
        lockedAt: null,
        lastError:
          "Expired scheduler lock released.",
      },
    }
  );
};

const claimDueSchedule = async () => {
  const now = new Date();

  return LiveSchedule.findOneAndUpdate(
    {
      status: "Upcoming",

      scheduledAt: {
        $lte: now,
      },

      isProcessing: {
        $ne: true,
      },
    },

    {
      $set: {
        status: "Starting",
        isProcessing: true,
        lockedAt: now,
      },
    },

    {
      new: true,

      sort: {
        scheduledAt: 1,
      },
    }
  );
};

const processDueSchedules = async () => {
  let processed = 0;

  while (processed < 10) {
    const schedule =
      await claimDueSchedule();

    if (!schedule) {
      break;
    }

    processed += 1;

    scheduleRunner
      .runSchedule(schedule._id)
      .catch(async (error) => {
        console.error(
          "SCHEDULE RUNNER ERROR:",
          error
        );

        await LiveSchedule.findByIdAndUpdate(
          schedule._id,
          {
            $set: {
              status: "Failed",
              isProcessing: false,
              lockedAt: null,
              lastError:
                error.message ||
                "Schedule execution failed.",
            },
          }
        );
      });
  }
};

const stopExpiredLives = async () => {
  const expiredSchedules =
    await LiveSchedule.find({
      status: "Live",

      endsAt: {
        $ne: null,
        $lte: new Date(),
      },
    }).limit(10);

  for (const schedule of expiredSchedules) {
    try {
      const livePlatforms =
        schedule.platformResults
          .filter((result) =>
            [
              "starting",
              "live",
            ].includes(result.status)
          )
          .map(
            (result) =>
              result.platform
          );

      await liveService.stopPlatforms(
        schedule.userId,
        livePlatforms
      );

      schedule.status = "Completed";
      schedule.completedAt = new Date();
      schedule.isProcessing = false;
      schedule.lockedAt = null;

      schedule.platformResults.forEach(
        (result) => {
          if (
            [
              "starting",
              "live",
            ].includes(result.status)
          ) {
            result.status = "completed";
            result.completedAt =
              new Date();
          }
        }
      );

      await schedule.save();
    } catch (error) {
      console.error(
        `STOP SCHEDULE ${schedule._id} ERROR:`,
        error
      );

      schedule.lastError =
        error.message ||
        "Unable to stop live session.";

      await schedule.save();
    }
  }
};

const processWorkerCycle = async () => {
  if (workerRunning) {
    return;
  }

  workerRunning = true;

  try {
    await releaseExpiredLocks();
    await processDueSchedules();
    await stopExpiredLives();
  } catch (error) {
    console.error(
      "SCHEDULE WORKER ERROR:",
      error
    );
  } finally {
    workerRunning = false;
  }
};

exports.startScheduleWorker = () => {
  if (workerStarted) {
    return;
  }

  workerStarted = true;

  cron.schedule("* * * * *", () => {
    processWorkerCycle();
  });

  processWorkerCycle();

  console.log(
    "Live schedule worker started."
  );
};

exports.processDueSchedules =
  processDueSchedules;

exports.stopExpiredLives =
  stopExpiredLives;