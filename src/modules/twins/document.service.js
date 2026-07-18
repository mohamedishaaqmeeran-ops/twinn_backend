const mammoth = require("mammoth");
const { PDFParse } = require("pdf-parse");
const axios = require("axios");
const cheerio = require("cheerio");

const clean = (v) =>
  String(v || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

exports.extractKnowledge = async ({
  file,
  text,
  websiteUrl,
}) => {
  if (file?.buffer) {
    /* ===========================
       PDF
    =========================== */

    if (file.mimetype === "application/pdf") {
      let parser;

      try {
        parser = new PDFParse({
          data: file.buffer,
        });

        const result =
          await parser.getText();

        return {
          text: clean(result.text),
          sourceType: "file",
          sourceUrl: "",
        };
      } finally {
        if (
          parser &&
          typeof parser.destroy ===
            "function"
        ) {
          await parser.destroy();
        }
      }
    }

    /* ===========================
       DOCX
    =========================== */

    if (
      file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result =
        await mammoth.extractRawText({
          buffer: file.buffer,
        });

      return {
        text: clean(result.value),
        sourceType: "file",
        sourceUrl: "",
      };
    }

    /* ===========================
       TXT / CSV
    =========================== */

    if (
      ["text/plain", "text/csv"].includes(
        file.mimetype
      )
    ) {
      return {
        text: clean(
          file.buffer.toString("utf8")
        ),
        sourceType: "file",
        sourceUrl: "",
      };
    }

    const error = new Error(
      "Unsupported knowledge document."
    );

    error.statusCode = 400;

    throw error;
  }

  /* ===========================
     WEBSITE
  =========================== */

  if (websiteUrl?.trim()) {
    const response =
      await axios.get(
        websiteUrl.trim(),
        {
          timeout: 15000,
          maxContentLength:
            5 * 1024 * 1024,
        }
      );

    const $ = cheerio.load(
      response.data
    );

    $(
      "script,style,noscript,iframe,svg"
    ).remove();

    return {
      text: clean($("body").text()),
      sourceType: "website",
      sourceUrl:
        websiteUrl.trim(),
    };
  }

  /* ===========================
     RAW TEXT
  =========================== */

  if (text?.trim()) {
    return {
      text: clean(text),
      sourceType: "text",
      sourceUrl: "",
    };
  }

  const error = new Error(
    "Provide a document, website URL or training text."
  );

  error.statusCode = 400;

  throw error;
};

exports.chunkText = (
  text,
  size = 1500,
  overlap = 200
) => {
  const value = clean(text);

  if (!value) return [];

  const chunks = [];

  let start = 0;

  while (start < value.length) {
    let end = Math.min(
      start + size,
      value.length
    );

    if (end < value.length) {
      const boundary = Math.max(
        value.lastIndexOf("\n\n", end),
        value.lastIndexOf(". ", end),
        value.lastIndexOf(" ", end)
      );

      if (boundary > start + 500) {
        end = boundary + 1;
      }
    }

    const chunk = value
      .slice(start, end)
      .trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= value.length) {
      break;
    }

    start = Math.max(
      end - overlap,
      start + 1
    );
  }

  return chunks;
};