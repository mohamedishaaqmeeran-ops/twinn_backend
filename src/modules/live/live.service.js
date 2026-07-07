const fetch = require("node-fetch");
const { spawn } = require("child_process");
const Connection = require("../../models/Connection");

const runningStreams = new Map();

class LiveService {
  startFFmpeg({ userId, platform, videoPath, streamUrl }) {
    const key = `${userId}-${platform}`;

    if (runningStreams.has(key)) {
      throw new Error(`${platform} live is already running.`);
    }

    const ffmpeg = spawn("ffmpeg", [
      "-re",
      "-stream_loop",
      "-1",
      "-i",
      videoPath,
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
      "50",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ar",
      "44100",
      "-f",
      "flv",
      streamUrl,
    ]);

    ffmpeg.stderr.on("data", (data) => {
      console.log(`[${platform} FFmpeg]:`, data.toString());
    });

    ffmpeg.on("close", () => {
      runningStreams.delete(key);
    });

    runningStreams.set(key, ffmpeg);

    return {
      platform,
      started: true,
    };
  }

  async startInstagramRTMP(userId, body) {
    const { rtmpUrl, streamKey, videoPath } = body;

    if (!rtmpUrl || !streamKey || !videoPath) {
      throw new Error("RTMP URL, stream key and video path are required.");
    }

    const streamUrl = `${rtmpUrl}/${streamKey}`;

    return this.startFFmpeg({
      userId,
      platform: "instagram",
      videoPath,
      streamUrl,
    });
  }

  async startFacebookLive(userId, body) {
    const { videoPath, title, description } = body;

    if (!videoPath) {
      throw new Error("Video path is required.");
    }

    const connection = await Connection.findOne({
      userId,
      platform: "facebook",
      connected: true,
    });

    if (!connection || !connection.pageId || !connection.pageAccessToken) {
      throw new Error("Facebook Page is not connected.");
    }

    const url = `https://graph.facebook.com/v23.0/${connection.pageId}/live_videos`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: connection.pageAccessToken,
        status: "LIVE_NOW",
        title: title || "Twinn Live Shopping",
        description: description || "Live shopping powered by Twinn.live",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Unable to create Facebook live.");
    }

    const streamUrl = data.secure_stream_url || data.stream_url;

    if (!streamUrl) {
      throw new Error("Facebook stream URL not received.");
    }

    await Connection.findOneAndUpdate(
      { userId, platform: "facebook" },
      { facebookLiveVideoId: data.id }
    );

    this.startFFmpeg({
      userId,
      platform: "facebook",
      videoPath,
      streamUrl,
    });

    return {
      liveVideoId: data.id,
      streamUrl,
    };
  }

  async stopLive(userId, platform) {
    const key = `${userId}-${platform}`;
    const ffmpeg = runningStreams.get(key);

    if (ffmpeg) {
      ffmpeg.kill("SIGTERM");
      runningStreams.delete(key);
    }

    return true;
  }

  async stopFacebookLive(userId) {
    await this.stopLive(userId, "facebook");

    const connection = await Connection.findOne({
      userId,
      platform: "facebook",
    });

    if (!connection?.facebookLiveVideoId || !connection?.pageAccessToken) {
      return true;
    }

    await fetch(
      `https://graph.facebook.com/v23.0/${connection.facebookLiveVideoId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: connection.pageAccessToken,
          end_live_video: true,
        }),
      }
    );

    return true;
  }
}

module.exports = new LiveService();