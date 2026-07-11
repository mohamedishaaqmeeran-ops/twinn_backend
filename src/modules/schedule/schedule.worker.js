const cron = require("node-cron");

const LiveSchedule =
  require("../../models/LiveSchedule");

const scheduleRunner =
  require("./schedule.runner");

let workerStarted = false;

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
      status: "Upcoming",
      isProcessing: false,
      lockedAt: null,
      lastError:
        "Expired scheduler lock released.",
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
  try {
    await releaseExpiredLocks();

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
              status: "Failed",
              isProcessing: false,
              lockedAt: null,
              lastError: error.message,
            }
          );
        });
    }
  } catch (error) {
    console.error(
      "SCHEDULE WORKER ERROR:",
      error
    );
  }
};

exports.startScheduleWorker = () => {
  if (workerStarted) {
    return;
  }

  workerStarted = true;

  // Runs every minute.
  cron.schedule("* * * * *", () => {
    processDueSchedules();
  });

  // Check immediately after server startup.
  processDueSchedules();

  console.log(
    "Live schedule worker started."
  );
};

exports.processDueSchedules =
  processDueSchedules;