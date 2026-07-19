const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const {
  GoogleGenAI,
} = require("@google/genai");

/* =========================================================
   BASIC HELPERS
========================================================= */

const wait = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const text = (value) => {
  return String(value || "").trim();
};

const positiveNumber = (
  value,
  fallback
) => {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return fallback;
  }

  return parsed;
};

/* =========================================================
   GOOGLE GEN AI CLIENT
========================================================= */

const getClient = () => {
  const apiKey =
    text(process.env.GEMINI_API_KEY);

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing."
    );
  }

  return new GoogleGenAI({
    apiKey,
  });
};

/* =========================================================
   IMAGE DOWNLOAD
========================================================= */

const fetchImageAsBase64 = async (
  imageUrl
) => {
  const normalizedImageUrl =
    text(imageUrl);

  if (!normalizedImageUrl) {
    throw new Error(
      "Avatar image URL is required."
    );
  }

  let response;

  try {
    response = await fetch(
      normalizedImageUrl
    );
  } catch (error) {
    throw new Error(
      `Unable to download avatar image: ${
        error?.message ||
        "Network request failed."
      }`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Unable to download avatar image: HTTP ${response.status}`
    );
  }

  const mimeType =
    response.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim() ||
    "image/png";

  const supportedMimeTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
  ];

  if (
    !supportedMimeTypes.includes(
      mimeType.toLowerCase()
    )
  ) {
    throw new Error(
      `Unsupported avatar image type: ${mimeType}`
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  const buffer =
    Buffer.from(arrayBuffer);

  const maximumImageSize =
    20 * 1024 * 1024;

  if (!buffer.length) {
    throw new Error(
      "Downloaded avatar image is empty."
    );
  }

  if (
    buffer.length >
    maximumImageSize
  ) {
    throw new Error(
      "Avatar image exceeds the 20 MB provider limit."
    );
  }

  return {
    imageBytes:
      buffer.toString("base64"),

    mimeType,

    size:
      buffer.length,
  };
};

/* =========================================================
   SAFE PROVIDER RESPONSE
========================================================= */

const makeSafeProviderResponse = (
  operation
) => {
  const response =
    operation?.response ||
    operation?.result ||
    null;

  return {
    name:
      text(operation?.name),

    done:
      operation?.done === true,

    hasResponse:
      Boolean(response),

    hasError:
      Boolean(
        operation?.error
      ),

    error:
      operation?.error || null,

    raiMediaFilteredCount:
      response?.raiMediaFilteredCount ||
      response
        ?.generateVideoResponse
        ?.raiMediaFilteredCount ||
      0,

    raiMediaFilteredReasons:
      response?.raiMediaFilteredReasons ||
      response
        ?.generateVideoResponse
        ?.raiMediaFilteredReasons ||
      [],
  };
};

/* =========================================================
   SAFETY FILTER EXTRACTION
========================================================= */

const extractSafetyFilterInfo = (
  operation
) => {
  const response =
    operation?.response ||
    operation?.result ||
    {};

  const nestedResponse =
    response?.generateVideoResponse ||
    {};

  const count =
    Number(
      response?.raiMediaFilteredCount ??
      nestedResponse
        ?.raiMediaFilteredCount ??
      0
    ) || 0;

  const rawReasons =
    response
      ?.raiMediaFilteredReasons ||
    nestedResponse
      ?.raiMediaFilteredReasons ||
    [];

  const reasons =
    Array.isArray(rawReasons)
      ? rawReasons
          .map((reason) =>
            text(
              reason?.message ||
              reason?.reason ||
              reason
            )
          )
          .filter(Boolean)
      : rawReasons
        ? [text(rawReasons)]
        : [];

  return {
    count,
    reasons,
    filtered:
      count > 0 ||
      reasons.length > 0,
  };
};

/* =========================================================
   POLL VIDEO GENERATION
========================================================= */

const pollVideoGeneration = async ({
  ai,
  operation,

  pollIntervalMs =
    positiveNumber(
      process.env
        .VEO_POLL_INTERVAL_MS,
      10000
    ),

  timeoutMs =
    positiveNumber(
      process.env
        .VEO_TIMEOUT_MS,
      15 * 60 * 1000
    ),
}) => {
  if (!ai) {
    throw new Error(
      "Google Gen AI client is required."
    );
  }

  if (!operation) {
    throw new Error(
      "Veo operation is required."
    );
  }

  const startedAt =
    Date.now();

  let current =
    operation;

  let pollAttempts = 0;

  while (
    current?.done !== true
  ) {
    const elapsed =
      Date.now() -
      startedAt;

    if (
      elapsed >
      timeoutMs
    ) {
      const timeoutError =
        new Error(
          "Veo video generation timed out."
        );

      timeoutError.code =
        "VEO_TIMEOUT";

      timeoutError.pollAttempts =
        pollAttempts;

      timeoutError.rawResponse =
        makeSafeProviderResponse(
          current
        );

      throw timeoutError;
    }

    pollAttempts += 1;

    await wait(
      Math.max(
        3000,
        pollIntervalMs
      )
    );

    try {
      current =
        await ai.operations
          .getVideosOperation({
            operation:
              current,
          });
    } catch (error) {
      const pollingError =
        new Error(
          error?.message ||
          "Unable to poll Veo operation."
        );

      pollingError.code =
        "VEO_POLLING_FAILED";

      pollingError.pollAttempts =
        pollAttempts;

      pollingError.rawResponse =
        makeSafeProviderResponse(
          current
        );

      throw pollingError;
    }

    console.log(
      "VEO POLL STATUS:",
      {
        pollAttempts,

        operationName:
          current?.name || "",

        done:
          current?.done === true,

        hasResponse:
          Boolean(
            current?.response ||
            current?.result
          ),

        hasError:
          Boolean(
            current?.error
          ),
      }
    );
  }

  if (current?.error) {
    const providerMessage =
      current.error?.message ||
      current.error?.status ||
      JSON.stringify(
        current.error
      ) ||
      "Veo video generation failed.";

    const providerError =
      new Error(
        providerMessage
      );

    providerError.code =
      "VEO_PROVIDER_ERROR";

    providerError.pollAttempts =
      pollAttempts;

    providerError.rawResponse =
      makeSafeProviderResponse(
        current
      );

    throw providerError;
  }

  return {
    operation:
      current,

    pollAttempts,

    elapsedMs:
      Date.now() -
      startedAt,
  };
};

/* =========================================================
   EXTRACT GENERATED VIDEO
========================================================= */

const extractGeneratedVideo = (
  operation
) => {
  const response =
    operation?.response ||
    operation?.result ||
    {};

  const nestedResponse =
    response
      ?.generateVideoResponse ||
    {};

  const generatedVideos =
    response?.generatedVideos ||
    nestedResponse
      ?.generatedVideos ||
    operation
      ?.generatedVideos ||
    [];

  const vertexVideos =
    response?.videos ||
    nestedResponse?.videos ||
    [];

  const generatedEntry =
    Array.isArray(
      generatedVideos
    )
      ? generatedVideos[0]
      : null;

  const vertexEntry =
    Array.isArray(
      vertexVideos
    )
      ? vertexVideos[0]
      : null;

  const generatedVideo =
    generatedEntry?.video ||
    generatedEntry ||
    vertexEntry?.video ||
    vertexEntry ||
    null;

  const uri =
    text(
      generatedVideo?.uri ||
      generatedVideo?.gcsUri ||
      generatedVideo?.fileUri ||
      generatedEntry?.uri ||
      generatedEntry?.gcsUri ||
      vertexEntry?.uri ||
      vertexEntry?.gcsUri
    );

  const videoBytes =
    generatedVideo
      ?.videoBytes ||
    generatedVideo
      ?.bytesBase64Encoded ||
    generatedEntry
      ?.videoBytes ||
    generatedEntry
      ?.bytesBase64Encoded ||
    "";

  const mimeType =
    text(
      generatedVideo?.mimeType ||
      generatedEntry?.mimeType ||
      vertexEntry?.mimeType ||
      "video/mp4"
    );

  const fileName =
    text(
      generatedVideo?.name ||
      generatedVideo?.fileName ||
      generatedEntry?.name ||
      vertexEntry?.name
    );

  return {
    generatedVideo,

    generatedEntry,

    vertexEntry,

    uri,

    videoBytes,

    mimeType,

    fileName,

    found:
      Boolean(
        generatedVideo ||
        uri ||
        videoBytes
      ),
  };
};


/* =========================================================
   GENERATE AVATAR VIDEO
========================================================= */

const generateAvatarVideo = async ({
  imageUrl,
  prompt,
  aspectRatio = process.env.VEO_ASPECT_RATIO || "16:9",
  resolution = process.env.VEO_RESOLUTION || "720p",
}) => {
  if (!text(imageUrl)) {
    throw new Error("Avatar image URL is required.");
  }

  if (!text(prompt)) {
    throw new Error("Video prompt is required.");
  }

  const ai = getClient();

  const image =
    await fetchImageAsBase64(imageUrl);

  let operation;

  try {
    operation =
      await ai.models.generateVideos({
        model:
          process.env.VEO_VIDEO_MODEL ||
          "veo-3.1-generate-preview",

        source: {
          prompt: text(prompt),
          image,
        },

        config: {
          numberOfVideos: 1,
          aspectRatio,
          resolution,
          personGeneration:
            "allow_adult",
        },
      });
  } catch (error) {
    const generationError =
      new Error(
        error?.message ||
          "Unable to start Veo generation."
      );

    generationError.code =
      "VEO_GENERATION_START_FAILED";

    throw generationError;
  }

  const providerJobId =
    text(operation?.name);

  const pollResult =
    await pollVideoGeneration({
      ai,
      operation,
    });

  operation =
    pollResult.operation;

  const safety =
    extractSafetyFilterInfo(
      operation
    );

  if (safety.filtered) {
    const filterError =
      new Error(
        safety.reasons.length
          ? safety.reasons.join(
              ", "
            )
          : "The generated video was blocked by Veo safety filtering."
      );

    filterError.code =
      "VEO_MEDIA_FILTERED";

    filterError.providerResponse =
      makeSafeProviderResponse(
        operation
      );

    throw filterError;
  }

  const extracted =
    extractGeneratedVideo(
      operation
    );

  if (!extracted.found) {
    console.error(
      "VEO FINAL RESPONSE:",
      JSON.stringify(
        operation,
        null,
        2
      )
    );

    const missingVideoError =
      new Error(
        "Veo completed without returning a generated video."
      );

    missingVideoError.code =
      "VEO_VIDEO_MISSING";

    missingVideoError.providerResponse =
      makeSafeProviderResponse(
        operation
      );

    throw missingVideoError;
  }

  return {
    ai,

    operation,

    generatedVideo:
      extracted.generatedVideo,

    providerJobId,

    operationName:
      text(operation?.name) ||
      providerJobId,

    resolution,

    mimeType:
      extracted.mimeType,

    videoUri:
      extracted.uri,

    videoBytes:
      extracted.videoBytes,

    providerResponse: {
      ...makeSafeProviderResponse(
        operation
      ),

      pollAttempts:
        pollResult.pollAttempts,

      elapsedMs:
        pollResult.elapsedMs,

      operationName:
        text(operation?.name),

      videoFound:
        extracted.found,

      uri:
        extracted.uri,

      mimeType:
        extracted.mimeType,
    },
  };
};

/* =========================================================
   DOWNLOAD GENERATED VIDEO
========================================================= */

const downloadGeneratedVideo = async ({
  generationResult,
  avatarVideoId =
    crypto.randomUUID(),
}) => {
  if (!generationResult) {
    throw new Error(
      "Video generation result is required."
    );
  }

  const ai =
    generationResult.ai ||
    getClient();

  const generatedVideo =
    generationResult.generatedVideo ||
    null;

  const videoBytes =
    generationResult.videoBytes ||
    generatedVideo?.videoBytes ||
    generatedVideo
      ?.bytesBase64Encoded ||
    "";

  const videoUri =
    text(
      generationResult.videoUri ||
      generatedVideo?.uri ||
      generatedVideo?.gcsUri ||
      generatedVideo?.fileUri
    );

  const directory =
    path.join(
      os.tmpdir(),
      "twinn-avatar-videos"
    );

  await fs.mkdir(
    directory,
    {
      recursive: true,
    }
  );

  const safeId =
    text(avatarVideoId).replace(
      /[^a-zA-Z0-9_-]/g,
      ""
    );

  const fileName =
    `${
      safeId ||
      crypto.randomUUID()
    }.mp4`;

  const filePath =
    path.join(
      directory,
      fileName
    );

  /* -------------------------------------------------------
     OPTION 1: INLINE BASE64 VIDEO
  ------------------------------------------------------- */

  if (videoBytes) {
    let buffer;

    try {
      buffer =
        Buffer.from(
          videoBytes,
          "base64"
        );
    } catch (error) {
      throw new Error(
        "Unable to decode generated video bytes."
      );
    }

    if (!buffer.length) {
      throw new Error(
        "Generated video bytes are empty."
      );
    }

    await fs.writeFile(
      filePath,
      buffer
    );

    return filePath;
  }

  /* -------------------------------------------------------
     OPTION 2: GOOGLE SDK FILE DOWNLOAD
  ------------------------------------------------------- */

  if (
    generatedVideo &&
    ai?.files?.download
  ) {
    try {
      await ai.files.download({
        file:
          generatedVideo,

        downloadPath:
          filePath,
      });

      const stat =
        await fs.stat(
          filePath
        );

      if (
        !stat.size
      ) {
        throw new Error(
          "Downloaded video file is empty."
        );
      }

      return filePath;
    } catch (error) {
      console.error(
        "GOOGLE SDK VIDEO DOWNLOAD ERROR:",
        error?.message
      );
    }
  }

  /* -------------------------------------------------------
     OPTION 3: DIRECT URI DOWNLOAD
  ------------------------------------------------------- */

  if (videoUri) {
    let response;

    try {
      response =
        await fetch(
          videoUri,
          {
            headers: {
              ...(process.env
                .GEMINI_API_KEY
                ? {
                    "x-goog-api-key":
                      process.env
                        .GEMINI_API_KEY,
                  }
                : {}),
            },
          }
        );
    } catch (error) {
      throw new Error(
        `Unable to download generated video: ${
          error?.message ||
          "Network request failed."
        }`
      );
    }

    if (!response.ok) {
      throw new Error(
        `Unable to download generated video: HTTP ${response.status}`
      );
    }

    const arrayBuffer =
      await response.arrayBuffer();

    const buffer =
      Buffer.from(
        arrayBuffer
      );

    if (!buffer.length) {
      throw new Error(
        "Downloaded generated video is empty."
      );
    }

    await fs.writeFile(
      filePath,
      buffer
    );

    return filePath;
  }

  throw new Error(
    "Generated video metadata does not contain downloadable video data."
  );
};

/* =========================================================
   CLEANUP GENERATED VIDEO FILE
========================================================= */

const cleanupGeneratedVideoFile =
  async (filePath) => {
    const normalizedPath =
      text(filePath);

    if (!normalizedPath) {
      return;
    }

    try {
      await fs.unlink(
        normalizedPath
      );
    } catch (error) {
      if (
        error?.code !==
        "ENOENT"
      ) {
        throw error;
      }
    }
  };

/* =========================================================
   OPTIONAL TEMP DIRECTORY CLEANUP
========================================================= */

const cleanupOldGeneratedVideoFiles =
  async ({
    maxAgeMs =
      24 *
      60 *
      60 *
      1000,
  } = {}) => {
    const directory =
      path.join(
        os.tmpdir(),
        "twinn-avatar-videos"
      );

    let entries;

    try {
      entries =
        await fs.readdir(
          directory,
          {
            withFileTypes:
              true,
          }
        );
    } catch (error) {
      if (
        error?.code ===
        "ENOENT"
      ) {
        return {
          deleted: 0,
        };
      }

      throw error;
    }

    let deleted = 0;

    const now =
      Date.now();

    for (
      const entry of entries
    ) {
      if (
        !entry.isFile()
      ) {
        continue;
      }

      const entryPath =
        path.join(
          directory,
          entry.name
        );

      try {
        const stat =
          await fs.stat(
            entryPath
          );

        if (
          now -
            stat.mtimeMs >
          maxAgeMs
        ) {
          await fs.unlink(
            entryPath
          );

          deleted += 1;
        }
      } catch (error) {
        if (
          error?.code !==
          "ENOENT"
        ) {
          console.error(
            "TEMP VIDEO CLEANUP ERROR:",
            error?.message
          );
        }
      }
    }

    return {
      deleted,
    };
  };

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  generateAvatarVideo,
  pollVideoGeneration,
  downloadGeneratedVideo,
  cleanupGeneratedVideoFile,
  cleanupOldGeneratedVideoFiles,
};