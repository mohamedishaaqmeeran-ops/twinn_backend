const {
  GoogleGenAI,
} = require("@google/genai");

const ai =
  new GoogleGenAI({
    apiKey:
      process.env
        .GEMINI_API_KEY,
  });

const VEO_MODEL =
  process.env
    .VEO_VIDEO_MODEL ||
  "veo-3.1-generate-001";

/* =========================================================
   DEFAULT AVATAR MOTION PROMPT
========================================================= */

const DEFAULT_AVATAR_PROMPT = `
Create a realistic professional AI avatar motion video from this image.

Keep the person's identity, face, hairstyle, skin tone, clothing and background
consistent with the uploaded image.

The person should:
- face the camera
- blink naturally
- breathe naturally
- make subtle head movements
- make small natural shoulder movements
- maintain a friendly and confident facial expression
- appear ready to present a product
- remain centered in the frame

Use smooth realistic movement.
Use professional studio quality.
Do not change the person's facial identity.
Do not add another person.
Do not add text, logos, captions or products.
Do not distort the face, hands or body.
Keep camera movement minimal.
Create a seamless short looping-style presentation video.
`;

/* =========================================================
   DOWNLOAD IMAGE
========================================================= */

const downloadImage =
  async (
    imageUrl
  ) => {
    const response =
      await fetch(
        imageUrl
      );

    if (!response.ok) {
      throw new Error(
        `Unable to download avatar image: ${response.status}`
      );
    }

    const arrayBuffer =
      await response
        .arrayBuffer();

    const buffer =
      Buffer.from(
        arrayBuffer
      );

    const mimeType =
      response.headers.get(
        "content-type"
      ) ||
      "image/jpeg";

    return {
      buffer,
      mimeType,
    };
  };

/* =========================================================
   GENERATE VIDEO
========================================================= */

const generateAvatarVideo =
  async ({
    imageUrl,
    prompt =
      DEFAULT_AVATAR_PROMPT,
  }) => {
    if (!imageUrl) {
      throw new Error(
        "Avatar image URL is required."
      );
    }

    const {
      buffer,
      mimeType,
    } =
      await downloadImage(
        imageUrl
      );

    let operation =
      await ai.models
        .generateVideos({
          model:
            VEO_MODEL,

          prompt,

          image: {
            imageBytes:
              buffer.toString(
                "base64"
              ),

            mimeType,
          },

          config: {
            aspectRatio:
              "9:16",

            durationSeconds:
              "8",

            resolution:
              "720p",

            personGeneration:
              "allow_adult",

            numberOfVideos:
              1,
          },
        });

    while (
      !operation.done
    ) {
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            10000
          )
      );

      operation =
        await ai.operations
          .get({
            operation,
          });
    }

    if (
      operation.error
    ) {
      throw new Error(
        operation.error
          .message ||
          "Veo video generation failed."
      );
    }

    const generatedVideo =
      operation.response
        ?.generatedVideos?.[0]
        ?.video;

    if (
      !generatedVideo
    ) {
      throw new Error(
        "Veo did not return a generated video."
      );
    }

    const downloadedVideo =
      await ai.files
        .download({
          file:
            generatedVideo,
        });

    let videoBuffer;

    if (
      Buffer.isBuffer(
        downloadedVideo
      )
    ) {
      videoBuffer =
        downloadedVideo;
    } else if (
      downloadedVideo
        ?.videoBytes
    ) {
      videoBuffer =
        Buffer.from(
          downloadedVideo
            .videoBytes,
          "base64"
        );
    } else if (
      generatedVideo
        ?.videoBytes
    ) {
      videoBuffer =
        Buffer.from(
          generatedVideo
            .videoBytes,
          "base64"
        );
    } else {
      throw new Error(
        "Unable to read the generated video data."
      );
    }

    return {
      videoBuffer,

      mimeType:
        "video/mp4",

      operationName:
        operation.name ||
        "",
    };
  };

module.exports = {
  DEFAULT_AVATAR_PROMPT,
  generateAvatarVideo,
};