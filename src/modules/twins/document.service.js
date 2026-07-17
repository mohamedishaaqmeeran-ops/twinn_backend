const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const axios = require("axios");
const cheerio = require("cheerio");
const clean = (v) => String(v || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
exports.extractKnowledge = async ({ file, text, websiteUrl }) => {
  if (file?.buffer) {
    if (file.mimetype === "application/pdf") return { text: clean((await pdfParse(file.buffer)).text), sourceType: "file", sourceUrl: "" };
    if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return { text: clean((await mammoth.extractRawText({ buffer: file.buffer })).value), sourceType: "file", sourceUrl: "" };
    if (["text/plain", "text/csv"].includes(file.mimetype)) return { text: clean(file.buffer.toString("utf8")), sourceType: "file", sourceUrl: "" };
    const error = new Error("Unsupported knowledge document."); error.statusCode = 400; throw error;
  }
  if (websiteUrl?.trim()) {
    const response = await axios.get(websiteUrl.trim(), { timeout: 15000, maxContentLength: 5 * 1024 * 1024 });
    const $ = cheerio.load(response.data); $("script,style,noscript,iframe,svg").remove();
    return { text: clean($("body").text()), sourceType: "website", sourceUrl: websiteUrl.trim() };
  }
  if (text?.trim()) return { text: clean(text), sourceType: "text", sourceUrl: "" };
  const error = new Error("Provide a document, website URL or training text."); error.statusCode = 400; throw error;
};
exports.chunkText = (text, size = 1500, overlap = 200) => {
  const value = clean(text); if (!value) return [];
  const chunks = []; let start = 0;
  while (start < value.length) {
    let end = Math.min(start + size, value.length);
    if (end < value.length) { const b = Math.max(value.lastIndexOf("\n\n", end), value.lastIndexOf(". ", end), value.lastIndexOf(" ", end)); if (b > start + 500) end = b + 1; }
    const chunk = value.slice(start, end).trim(); if (chunk) chunks.push(chunk);
    if (end >= value.length) break; start = Math.max(end - overlap, start + 1);
  }
  return chunks;
};
