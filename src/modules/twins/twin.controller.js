const twinService = require("./twin.service");

exports.create = async (req, res) => {
  try {
    const twins = await twinService.getTwins(req.user.id);

    const maxTwins =
      req.user.plan === "pro" || req.user.plan === "business" ? 3 : 1;

    if (twins.length >= maxTwins) {
      return res.status(403).json({
        success: false,
        message: "Twin limit reached. Upgrade your plan.",
      });
    }

    const twin = await twinService.createTwin(req.user.id, req.body);

    res.status(201).json({
      success: true,
      message: "Twin created successfully",
      twin,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.list = async (req, res) => {
  try {
    const twins = await twinService.getTwins(req.user.id);

    res.json({
      success: true,
      twins,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.single = async (req, res) => {
  try {
    const twin = await twinService.getTwin(req.params.id, req.user.id);

    if (!twin) {
      return res.status(404).json({
        success: false,
        message: "Twin not found",
      });
    }

    res.json({
      success: true,
      twin,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.update = async (req, res) => {
  try {
    const twin = await twinService.updateTwin(
      req.params.id,
      req.user.id,
      req.body
    );

    if (!twin) {
      return res.status(404).json({
        success: false,
        message: "Twin not found",
      });
    }

    res.json({
      success: true,
      message: "Twin updated successfully",
      twin,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.remove = async (req, res) => {
  try {
    const twin = await twinService.deleteTwin(req.params.id, req.user.id);

    if (!twin) {
      return res.status(404).json({
        success: false,
        message: "Twin not found",
      });
    }

    res.json({
      success: true,
      message: "Twin deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};