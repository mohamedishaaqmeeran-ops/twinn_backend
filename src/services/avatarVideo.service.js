const fs = require("fs");
const axios = require("axios");

const {
  GoogleGenAI,
} = require("@google/genai");

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
   CLEAN TEXT
========================================================= */

const cleanText = (
  value,
  maxLength = 300
) => {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value)
    .replace(/\s+/g, " ")
    .replace(/["“”]/g, "")
    .trim()
    .slice(0, maxLength);
};

/* =========================================================
   FORMAT PRICE
========================================================= */

const formatPrice = (
  product
) => {
  const price =
    product?.price ??
    product?.salePrice ??
    product?.sellingPrice;

  if (
    price === undefined ||
    price === null ||
    price === ""
  ) {
    return "";
  }

  const currency =
    cleanText(
      product?.currency ||
        product?.currencyCode ||
        "INR",
      10
    ).toUpperCase();

  const numericPrice =
    Number(price);

  const formattedPrice =
    Number.isFinite(numericPrice)
      ? numericPrice.toLocaleString(
          "en-IN"
        )
      : cleanText(price, 30);

  if (currency === "INR") {
    return `${formattedPrice} rupees`;
  }

  if (currency === "USD") {
    return `${formattedPrice} dollars`;
  }

  return `${formattedPrice} ${currency}`;
};

/* =========================================================
   NORMALIZE FEATURES
========================================================= */

const getProductFeatures = (
  product
) => {
  if (
    Array.isArray(product?.features)
  ) {
    return product.features
      .map((feature) => {
        if (
          typeof feature === "string"
        ) {
          return cleanText(
            feature,
            80
          );
        }

        return cleanText(
          feature?.name ||
            feature?.title ||
            feature?.value,
          80
        );
      })
      .filter(Boolean)
      .slice(0, 2);
  }

  if (
    typeof product?.features ===
    "string"
  ) {
    return product.features
      .split(/[,|;\n]/)
      .map((feature) =>
        cleanText(feature, 80)
      )
      .filter(Boolean)
      .slice(0, 2);
  }

  return [];
};

/* =========================================================
   BUILD PRODUCT SPEECH
========================================================= */

const buildProductSpeech = ({
  product,
}) => {
  const productName =
    cleanText(
      product?.name ||
        product?.productName ||
        product?.title ||
        "this product",
      80
    );

  const brand =
    cleanText(
      product?.brand ||
        product?.brandName,
      60
    );

  const shortDescription =
    cleanText(
      product?.shortDescription ||
        product?.description,
      130
    );

  const features =
    getProductFeatures(product);

  const price =
    formatPrice(product);

  const sentences = [];

  sentences.push(
    `Meet ${productName}.`
  );

  if (brand) {
    sentences.push(
      `It is presented by ${brand}.`
    );
  }

  /*
   * Keep the dialogue short because the generated
   * video duration is only eight seconds.
   */

  if (shortDescription) {
    sentences.push(
      shortDescription
    );
  } else if (features.length > 0) {
    sentences.push(
      `It features ${features.join(
        " and "
      )}.`
    );
  }

  if (price) {
    sentences.push(
      `It is available for ${price}.`
    );
  }

  return sentences
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

/* =========================================================
   DOWNLOAD IMAGE
========================================================= */

const downloadImage =
  async (imageUrl) => {
    const response =
      await axios.get(
        imageUrl,
        {
          responseType:
            "arraybuffer",

          timeout: 30000,

          maxContentLength:
            15 * 1024 * 1024,

          headers: {
            Accept:
              "image/png,image/jpeg,image/webp",
          },
        }
      );

    const contentType =
      response.headers[
        "content-type"
      ] || "image/jpeg";

    if (
      !contentType.startsWith(
        "image/"
      )
    ) {
      throw new Error(
        `Avatar URL did not return an image. Received: ${contentType}`
      );
    }

    const buffer =
      Buffer.from(
        response.data
      );

    if (!buffer.length) {
      throw new Error(
        "Downloaded avatar image is empty."
      );
    }

    return {
      imageBytes:
        buffer.toString(
          "base64"
        ),

      mimeType:
        contentType
          .split(";")[0]
          .trim(),
    };
  };

/* =========================================================
   WAIT
========================================================= */

const wait = (
  milliseconds
) =>
  new Promise((resolve) => {
    setTimeout(
      resolve,
      milliseconds
    );
  });

/* =========================================================
   GENERATE AVATAR VIDEO
========================================================= */

const generateAvatarVideo =
  async ({
    imageUrl,
    product,
  }) => {
    if (
      !process.env
        .GEMINI_API_KEY
    ) {
      throw new Error(
        "GEMINI_API_KEY is missing."
      );
    }

    if (!imageUrl) {
      throw new Error(
        "Avatar image URL is required."
      );
    }

    if (
      !product ||
      typeof product !==
        "object"
    ) {
      throw new Error(
        "Product details are required for avatar video generation."
      );
    }

    const productName =
      cleanText(
        product?.name ||
          product?.productName ||
          product?.title ||
          "the product",
        80
      );

    const productSpeech =
      buildProductSpeech({
        product,
      });

    if (!productSpeech) {
      throw new Error(
        "Unable to build product speech from the supplied product."
      );
    }

    console.log(
      "STARTING VEO AVATAR VIDEO:",
      {
        model:
          VIDEO_MODEL,

        productName,

        productSpeech,
      }
    );

    const {
      imageBytes,
      mimeType,
    } =
      await downloadImage(
        imageUrl
      );

    const prompt = `
Create a realistic vertical product presentation video from the supplied presenter image.

Preserve the presenter's identity, facial features, hairstyle, skin tone, clothing and overall appearance.

The presenter looks directly at the camera and clearly says this exact dialogue in English:

${productSpeech}

Presentation requirements:
- Natural and confident English voice
- Accurate lip synchronization
- Clearly pronounce "${productName}"
- Natural blinking and smiling
- Subtle head and upper-body movement
- Small professional hand gestures
- Keep the presenter centered
- Clear studio-quality speech

Restrictions:
- Do not change the presenter's identity
- Do not add another person
- Do not add subtitles or visible text
- Do not add background music
- Do not add unrelated products
- Do not invent claims, prices, discounts or features
- Speak only the supplied dialogue
`.trim();

    let operation =
      await ai.models
        .generateVideos({
          model:
            VIDEO_MODEL,

          prompt,

          image: {
            imageBytes,
            mimeType,
          },

          config: {
            aspectRatio:
              "9:16",

            resolution:
              "720p",

            durationSeconds:
              8,

            numberOfVideos:
              1,
          },
        });

    const operationName =
      operation?.name ||
      "";

    const startedAt =
      Date.now();

    while (
      !operation?.done
    ) {
      if (
        Date.now() -
          startedAt >
        TIMEOUT
      ) {
        throw new Error(
          "Avatar video generation timed out."
        );
      }

      await wait(
        POLL_INTERVAL
      );

      operation =
        await ai.operations
          .getVideosOperation({
            operation,
          });

      console.log(
        "VEO VIDEO STATUS:",
        {
          operationName,
          done:
            Boolean(
              operation?.done
            ),
        }
      );
    }

    if (
      operation?.error
    ) {
      throw new Error(
        operation.error
          .message ||
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

    try {
      await ai.files.download({
        file:
          generatedVideo,

        downloadPath,
      });

      const videoBuffer =
        await fs.promises
          .readFile(
            downloadPath
          );

      if (
        !videoBuffer.length
      ) {
        throw new Error(
          "Downloaded Veo video is empty."
        );
      }

      return {
        videoBuffer,

        operationName,

        model:
          VIDEO_MODEL,

        prompt,

        productSpeech,
      };
    } finally {
      await fs.promises
        .unlink(
          downloadPath
        )
        .catch(() => {});
    }
  };

module.exports = {
  generateAvatarVideo,
  buildProductSpeech,
};