const scheduleService =
  require("./schedule.service");

exports.createSchedule = async (req, res) => {
  try {
    const schedule =
      await scheduleService.createSchedule({
        user: req.user,
        payload: req.body,
      });

    return res.status(201).json({
      success: true,
      message:
        "Live session scheduled successfully.",
      schedule,
    });
  } catch (error) {
    console.error(
      "CREATE SCHEDULE ERROR:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getSchedules = async (req, res) => {
  try {
    const schedules =
      await scheduleService.getSchedules(
        req.user.id
      );

    return res.json({
      success: true,
      schedules,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getSchedule = async (req, res) => {
  try {
    const schedule =
      await scheduleService.getSchedule({
        userId: req.user.id,
        scheduleId: req.params.id,
      });

    return res.json({
      success: true,
      schedule,
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

exports.cancelSchedule = async (
  req,
  res
) => {
  try {
    const schedule =
      await scheduleService.cancelSchedule({
        userId: req.user.id,
        scheduleId: req.params.id,
      });

    return res.json({
      success: true,
      message:
        "Schedule cancelled successfully.",
      schedule,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteSchedule = async (
  req,
  res
) => {
  try {
    await scheduleService.deleteSchedule({
      userId: req.user.id,
      scheduleId: req.params.id,
    });

    return res.json({
      success: true,
      message:
        "Schedule deleted successfully.",
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};