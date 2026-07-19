const normalize = (value) => String(value ?? "").trim();

const buildAvatarVideoPrompt = async ({ twin, product, speech }) => {
  const twinName = normalize(twin?.name || twin?.twinName || "AI presenter");
  const productName = normalize(product?.name || product?.productName || product?.title || "product");
  const style = normalize(twin?.style || twin?.personality || "professional and friendly");
  const language = normalize(twin?.primaryLanguage || twin?.language || "English");

  return `
Create a polished 8-second live-commerce presenter video using the supplied avatar image as the visual identity.

Presenter: ${twinName}
Product: ${productName}
Style: ${style}
Spoken language: ${language}

The presenter faces the camera in a clean modern studio, maintains natural eye contact, uses subtle hand gestures, realistic blinking, accurate facial movement, and confident product-presenter energy. Keep the same face, hairstyle, clothing identity, and overall appearance as the input image. Use a stable medium shot with gentle cinematic movement.

The presenter says:
"${normalize(speech)}"

Audio must be clear and natural. Lip movement should match the speech as closely as possible. Avoid distorted hands, duplicated limbs, identity changes, text overlays, subtitles, logos, watermarks, camera shake, background crowds, and abrupt cuts.
  `.trim();
};

module.exports = { buildAvatarVideoPrompt };
