const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const router = express.Router();
let liveProcess = null;

const uploadDir = path.join(process.cwd(), "public", "videos");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `live-${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

router.post("/upload-video", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Video file is required",
    });
  }

  res.json({
    success: true,
    message: "Video uploaded successfully",
    videoPath: req.file.path,
  });
});

router.post("/start-instagram-rtmp", (req, res) => {
  const { rtmpUrl, streamKey, videoPath } = req.body;

  if (!rtmpUrl || !streamKey || !videoPath) {
    return res.status(400).json({
      success: false,
      message: "rtmpUrl, streamKey and videoPath are required",
    });
  }

  if (liveProcess) {
    return res.status(400).json({
      success: false,
      message: "Live already running",
    });
  }

  const cleanRtmpUrl = rtmpUrl.replace(/\/$/, "");
  const fullRtmpUrl = `${cleanRtmpUrl}/${streamKey}`;

  const finalVideoPath = path.isAbsolute(videoPath)
    ? videoPath
    : path.join(process.cwd(), videoPath);

  if (!fs.existsSync(finalVideoPath) && !videoPath.startsWith("http")) {
    return res.status(400).json({
      success: false,
      message: `Video file not found: ${finalVideoPath}`,
    });
  }

  liveProcess = spawn("ffmpeg", [
    "-re",
    "-stream_loop",
    "-1",
    "-i",
    finalVideoPath,
    "-vf",
    "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-b:v",
    "2500k",
    "-maxrate",
    "2500k",
    "-bufsize",
    "5000k",
    "-pix_fmt",
    "yuv420p",
    "-g",
    "60",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "44100",
    "-f",
    "flv",
    fullRtmpUrl,
  ]);

  liveProcess.on("error", (error) => {
    console.log("FFmpeg start error:", error.message);
    liveProcess = null;
  });

  liveProcess.stderr.on("data", (data) => {
    console.log("FFmpeg:", data.toString());
  });

  liveProcess.on("close", (code) => {
    console.log("Instagram RTMP stopped with code:", code);
    liveProcess = null;
  });

  res.json({
    success: true,
    message: "Instagram RTMP stream started",
  });
});

router.post("/stop-instagram-rtmp", (req, res) => {
  if (!liveProcess) {
    return res.status(400).json({
      success: false,
      message: "No live stream running",
    });
  }

  liveProcess.kill("SIGINT");
  liveProcess = null;

  res.json({
    success: true,
    message: "Instagram RTMP stream stopped",
  });
});

module.exports = router;