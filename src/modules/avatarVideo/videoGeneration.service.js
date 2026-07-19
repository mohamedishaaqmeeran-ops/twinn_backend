const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { GoogleGenAI } = require("@google/genai");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
};

const fetchImageAsBase64 = async (imageUrl) => {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Unable to download avatar image: HTTP ${response.status}`);
  }

  const mimeType =
    response.headers.get("content-type")?.split(";")[0] || "image/png";

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length > 20 * 1024 * 1024) {
    throw new Error("Avatar image exceeds the 20 MB provider limit.");
  }

  return {
    imageBytes: buffer.toString("base64"),
    mimeType,
  };
};

const pollVideoGeneration = async ({
  ai,
  operation,
  pollIntervalMs = Number(process.env.VEO_POLL_INTERVAL_MS || 10000),
  timeoutMs = Number(process.env.VEO_TIMEOUT_MS || 15 * 60 * 1000),
}) => {
  const startedAt = Date.now();
  let current = operation;

  while (!current?.done) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Veo video generation timed out.");
    }

    await wait(Math.max(3000, pollIntervalMs));

    current = await ai.operations.getVideosOperation({
      operation: current,
    });
  }

  if (current?.error) {
    throw new Error(
      current.error.message ||
        JSON.stringify(current.error) ||
        "Veo video generation failed."
    );
  }

  return current;
};

const generateAvatarVideo = async ({
  imageUrl,
  prompt,
  aspectRatio = process.env.VEO_ASPECT_RATIO || "16:9",
  resolution = process.env.VEO_RESOLUTION || "720p",
}) => {
  if (!imageUrl) throw new Error("Avatar image URL is required.");
  if (!prompt) throw new Error("Video prompt is required.");

  const ai = getClient();
  const image = await fetchImageAsBase64(imageUrl);

  let operation = await ai.models.generateVideos({
    model: process.env.VEO_VIDEO_MODEL || "veo-3.1-generate-preview",
    source: {
      prompt,
      image,
    },
    config: {
      numberOfVideos: 1,
      aspectRatio,
      resolution,
      personGeneration: "allow_adult",
    },
  });

  const providerJobId = operation?.name || "";
  operation = await pollVideoGeneration({ ai, operation });

  const generatedVideo = operation?.response?.generatedVideos?.[0]?.video;

  if (!generatedVideo) {
    throw new Error("Veo completed without returning a generated video.");
  }

  return {
    ai,
    operation,
    generatedVideo,
    providerJobId,
    operationName: operation?.name || providerJobId,
    resolution,
    mimeType: generatedVideo.mimeType || "video/mp4",
    providerResponse: {
      name: operation?.name || providerJobId,
      done: operation?.done === true,
    },
  };
};

const downloadGeneratedVideo = async ({
  generationResult,
  avatarVideoId = crypto.randomUUID(),
}) => {
  const ai = generationResult?.ai || getClient();
  const video = generationResult?.generatedVideo;

  if (!video) {
    throw new Error("Generated video metadata is missing.");
  }

  const directory = path.join(os.tmpdir(), "twinn-avatar-videos");
  await fs.mkdir(directory, { recursive: true });

  const safeId = String(avatarVideoId).replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(directory, `${safeId || crypto.randomUUID()}.mp4`);

  if (video.videoBytes) {
    await fs.writeFile(filePath, Buffer.from(video.videoBytes, "base64"));
    return filePath;
  }

  await ai.files.download({
    file: video,
    downloadPath: filePath,
  });

  return filePath;
};

const cleanupGeneratedVideoFile = async (filePath) => {
  if (!filePath) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
};

module.exports = {
  generateAvatarVideo,
  pollVideoGeneration,
  downloadGeneratedVideo,
  cleanupGeneratedVideoFile,
};
