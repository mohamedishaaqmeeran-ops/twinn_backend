const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const cheerio = require("cheerio");

const normalizeText = (text = "") => {
  return String(text)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

exports.extractTextFromFile = async (file) => {
  if (!file?.buffer) {
    throw new Error("Knowledge file is missing.");
  }

  if (
    file.mimetype === "text/plain" ||
    file.mimetype === "text/csv"
  ) {
    return normalizeText(
      file.buffer.toString("utf-8")
    );
  }

  if (file.mimetype === "application/pdf") {
    const result = await pdfParse(file.buffer);

    return normalizeText(result.text);
  }

  if (
    file.mimetype ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({
      buffer: file.buffer,
    });

    return normalizeText(result.value);
  }

  if (file.mimetype === "application/msword") {
    throw new Error(
      "Old .doc files are not supported. Convert the file to .docx or PDF."
    );
  }

  throw new Error(
    `Text extraction is not supported for ${file.mimetype}.`
  );
};

exports.extractTextFromWebsite = async (url) => {
  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("Invalid website URL.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error(
      "Website URL must use http:// or https://."
    );
  }

  const response = await fetch(parsedUrl.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 TwinnKnowledgeBot/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Unable to load website. Status: ${response.status}`
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  $(
    "script, style, noscript, iframe, nav, footer, form"
  ).remove();

  const title =
    $("title").first().text().trim() ||
    parsedUrl.hostname;

  const text = normalizeText($("body").text());

  if (!text) {
    throw new Error(
      "No readable text was found on the website."
    );
  }

  return {
    title,
    text,
  };
};

exports.chunkText = (
  text,
  {
    chunkSize = 1200,
    overlap = 200,
  } = {}
) => {
  const normalized = normalizeText(text);

  if (!normalized) {
    return [];
  }

  const chunks = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(
      start + chunkSize,
      normalized.length
    );

    if (end < normalized.length) {
      const paragraphBreak =
        normalized.lastIndexOf("\n", end);

      const sentenceBreak =
        normalized.lastIndexOf(". ", end);

      const preferredBreak = Math.max(
        paragraphBreak,
        sentenceBreak
      );

      if (
        preferredBreak > start + chunkSize * 0.5
      ) {
        end = preferredBreak + 1;
      }
    }

    const chunk = normalized
      .slice(start, end)
      .trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
};