const {
  GoogleGenAI,
} = require("@google/genai");

const axios = require("axios");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const VIDEO_MODEL =
  process.env.VEO_VIDEO_MODEL ||
  "veo-3.1-generate-preview";

const POLL_INTERVAL =
  Number(
    process.env.AVATAR_VIDEO_POLL_MS
  ) || 10000;

const TIMEOUT =
  Number(
    process.env.AVATAR_VIDEO_TIMEOUT_MS
  ) || 10 * 60 * 1000;

/* =========================================================
   DOWNLOAD IMAGE
========================================================= */

const downloadImage =
  async (imageUrl) => {
    const response = await axios.get(
      imageUrl,
      {
        responseType: "arraybuffer",
        timeout: 30000,
      }
    );

    const contentType =
      response.headers["content-type"] ||
      "image/jpeg";

    return {
      imageBytes: Buffer.from(
        response.data
      ).toString("base64"),

      mimeType: contentType,
    };
  };

/* =========================================================
   GENERATE AVATAR VIDEO
========================================================= */

const generateAvatarVideo =
  async ({ imageUrl }) => {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY is missing."
      );
    }

    if (!imageUrl) {
      throw new Error(
        "Avatar image URL is required."
      );
    }

    console.log(
      "GENERATING AVATAR VIDEO:",
      {
        model: VIDEO_MODEL,
        imageUrl,
      }
    );

    const {
      imageBytes,
      mimeType,
    } = await downloadImage(
      imageUrl
    );

    const prompt = `
Create a realistic professional AI presenter video using the supplied image as the first frame.

Preserve the person's identity, face, hairstyle, clothing and overall appearance.

The presenter should:
- look directly at the camera
- smile naturally
- blink naturally
- make subtle head movements
- use gentle professional body movement
- remain centered in the frame

Do not change the person's face.
Do not add text, logos, products or other people.
Use a clean professional presentation style.
`;

    let operation =
      await ai.models.generateVideos({
        model: VIDEO_MODEL,

        prompt,

        image: {
          imageBytes,
          mimeType,
        },

        config: {
          aspectRatio: "9:16",
          resolution: "720p",
          durationSeconds: 8,
          numberOfVideos: 1,
        },
      });

    const operationName =
      operation?.name || "";

    const startedAt = Date.now();

    while (!operation.done) {
      if (
        Date.now() - startedAt >
        TIMEOUT
      ) {
        throw new Error(
          "Avatar video generation timed out."
        );
      }

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            POLL_INTERVAL
          )
      );

      operation =
        await ai.operations
          .getVideosOperation({
            operation,
          });
    }

    if (operation.error) {
      throw new Error(
        operation.error.message ||
          "Veo video generation failed."
      );
    }

    const generatedVideo =
      operation?.response
        ?.generatedVideos?.[0]
        ?.video;

    if (!generatedVideo) {
      throw new Error(
        "Veo returned no generated video."
      );
    }

    const downloadPath =
      `/tmp/avatar-${Date.now()}.mp4`;

    await ai.files.download({
      file: generatedVideo,
      downloadPath,
    });

    const fs = require("fs");

    const videoBuffer =
      await fs.promises.readFile(
        downloadPath
      );

    await fs.promises.unlink(
      downloadPath
    ).catch(() => {});

    return {
      videoBuffer,
      operationName,
      model: VIDEO_MODEL,
      prompt,
    };
  };

module.exports = {
  generateAvatarVideo,
};