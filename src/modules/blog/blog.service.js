const slugify = (text) =>
  String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-");

const calculateReadTime = (
  content
) => {
  const words =
    String(content)
      .trim()
      .split(/\s+/).length;

  return Math.max(
    1,
    Math.ceil(words / 200)
  );
};

module.exports = {
  slugify,
  calculateReadTime,
};