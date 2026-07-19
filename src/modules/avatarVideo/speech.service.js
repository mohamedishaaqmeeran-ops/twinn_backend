const normalize = (value) => String(value ?? "").trim();

const formatPrice = (product) => {
  const value = product?.salePrice ?? product?.discountPrice ?? product?.price;
  if (value === undefined || value === null || value === "") return "";

  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";

  const currency = normalize(product?.currency || "INR").toUpperCase();

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

const buildBrandProductSpeech = async ({ twin, product }) => {
  const twinName = normalize(twin?.name || twin?.twinName || "your AI host");
  const brandName = normalize(twin?.brandName || twin?.brand || "");
  const productName = normalize(product?.name || product?.productName || product?.title || "this product");
  const description = normalize(product?.description || product?.productDescription || "");
  const price = formatPrice(product);
  const benefit = description
    ? description.split(/[.!?]/)[0].slice(0, 180)
    : "It is designed to offer excellent quality and everyday value";

  const brandIntro = brandName ? `from ${brandName}` : "";
  const priceLine = price ? ` It is available for ${price}.` : "";

  return [
    `Hi, I am ${twinName}.`,
    `Let me introduce ${productName} ${brandIntro}.`,
    `${benefit}.`,
    priceLine,
    "Take a closer look and choose it today.",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

module.exports = { buildBrandProductSpeech };
