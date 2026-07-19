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
  ) ||
  10 * 60 * 1000;

/* =========================================================
   WAIT
========================================================= */

const wait = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(
      resolve,
      milliseconds
    );
  });

/* =========================================================
   CLEAN TEXT
========================================================= */

const cleanText = (
  value,
  maxLength = 250
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

const formatPrice = (product) => {
  const price = product?.price;

  if (
    price === undefined ||
    price === null ||
    price === ""
  ) {
    return "";
  }

  const currency =
    cleanText(
      product?.currency || "INR",
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
   GET PRODUCT FEATURES
========================================================= */

const getProductFeatures = (
  product
) => {
  if (
    !Array.isArray(
      product?.features
    )
  ) {
    return [];
  }

  return product.features
    .map((feature) =>
      cleanText(feature, 60)
    )
    .filter(Boolean)
    .slice(0, 2);
};

/* =========================================================
   BUILD BRAND + PRODUCT SPEECH
========================================================= */

const buildBrandProductSpeech =
  ({
    twin,
    product,
  }) => {
    const brandName =
      cleanText(
        twin?.brandName ||
          twin?.name ||
          "our brand",
        50
      );

    const brandDescription =
      cleanText(
        twin?.brandDescription,
        90
      );

    const productName =
      cleanText(
        product?.name ||
          "this product",
        60
      );

    const productDescription =
      cleanText(
        product?.description,
        100
      );

    const features =
      getProductFeatures(
        product
      );

    const price =
      formatPrice(product);

    const sentences = [];

    sentences.push(
      `Welcome to ${brandName}.`
    );

    /*
     * Keep the complete speech short because
     * the generated video is only 8 seconds.
     */

    if (brandDescription) {
      sentences.push(
        brandDescription
      );
    }

    sentences.push(
      `Meet ${productName}.`
    );

    if (productDescription) {
      sentences.push(
        productDescription
      );
    } else if (
      features.length > 0
    ) {
      sentences.push(
        `It features ${features.join(
          " and "
        )}.`
      );
    }

    if (price) {
      sentences.push(
        `Available for ${price}.`
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
        "Avatar URL did not return an image."
      );
    }

    const imageBuffer =
      Buffer.from(
        response.data
      );

    if (!imageBuffer.length) {
      throw new Error(
        "Downloaded avatar image is empty."
      );
    }

    return {
      imageBytes:
        imageBuffer.toString(
          "base64"
        ),

      mimeType:
        contentType
          .split(";")[0]
          .trim(),
    };
  };

/* =========================================================
   GENERATE AVATAR VIDEO
========================================================= */

const generateAvatarVideo =
  async ({
    imageUrl,
    twin,
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

    if (!twin) {
      throw new Error(
        "Twin details are required for avatar video generation."
      );
    }

    if (!product) {
      throw new Error(
        "Product details are required for avatar video generation."
      );
    }

    const productName =
      cleanText(
        product?.name ||
          "the product",
        60
      );

    const brandName =
      cleanText(
        twin?.brandName ||
          twin?.name ||
          "the brand",
        60
      );

    const speech =
      buildBrandProductSpeech({
        twin,
        product,
      });

    if (!speech) {
      throw new Error(
        "Unable to create brand and product dialogue."
      );
    }

    console.log(
      "STARTING AVATAR VIDEO:",
      {
        model:
          VIDEO_MODEL,

        brandName,

        productName,

        speech,
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
Create a realistic vertical ecommerce presentation video using the supplied presenter image.

Preserve the presenter's exact identity, facial features, hairstyle, skin tone, clothing and appearance.

The presenter looks directly at the camera and says this exact dialogue clearly in English:

"${speech}"

Presentation requirements:
- Use a natural and friendly English voice
- Accurately synchronize the lips with the dialogue
- Clearly pronounce the brand name "${brandName}"
- Clearly pronounce the product name "${productName}"
- Smile naturally
- Blink naturally
- Use subtle head movement
- Use small professional hand gestures
- Keep the presenter centered
- Use clear studio-quality speech

Restrictions:
- Do not change the presenter's identity
- Do not introduce another person
- Do not add subtitles
- Do not add visible text
- Do not add background music
- Do not mention unrelated products
- Do not invent product features
- Do not invent prices or discounts
- Speak only the provided dialogue
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
      operation?.name || "";

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
        "VEO OPERATION STATUS:",
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
          ?.message ||
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

        speech,
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
  buildBrandProductSpeech,
};