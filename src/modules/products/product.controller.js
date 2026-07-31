const productService = require("./product.service");
const { createProductSchema, updateProductSchema, productListQuerySchema } = require("./product.validation");

const getUserId = (req) => req.userId || req.auth?.userId || req.user?.id || req.user?._id;
const getRole = (req) => req.userRole || req.auth?.role || req.user?.role || "";
const getAccess = (req) => ({
  userId: getUserId(req),
  role: getRole(req),
  ownerId: req.body?.ownerId || req.body?.brandCreatorId || req.query?.ownerId,
});

const validationError = (res, error) => res.status(400).json({
  success: false,
  code: "VALIDATION_ERROR",
  message: "Product validation failed",
  errors: error.details.map((item) => ({ field: item.path.join("."), message: item.message })),
});

const handleError = (res, error, fallback) => {
  console.error("PRODUCT CONTROLLER ERROR:", error);
  if (error?.statusCode && error?.code) {
    return res.status(error.statusCode).json({
      success: false, code: error.code, message: error.message, ...(error.details || {}),
    });
  }
  if (error?.name === "MulterError") {
    return res.status(400).json({ success: false, code: "PRODUCT_UPLOAD_ERROR", message: error.message });
  }
  if (error?.name === "ValidationError") {
    return res.status(400).json({ success: false, code: "PRODUCT_VALIDATION_ERROR", message: error.message });
  }
  if (error?.code === 11000) {
    return res.status(409).json({ success: false, code: "DUPLICATE_PRODUCT", message: "A product with this SKU already exists" });
  }
  return res.status(500).json({ success: false, code: "PRODUCT_OPERATION_FAILED", message: fallback });
};

const optionalNumber = (value) => value === undefined || value === null || value === "" ? undefined : Number(value);
const optionalBoolean = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (String(value).toLowerCase() === "true") return true;
  if (String(value).toLowerCase() === "false") return false;
  return value;
};
const arrayField = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed; } catch {}
  return String(value).split(",").map((x) => x.trim()).filter(Boolean);
};
const objectField = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try { return JSON.parse(value); } catch { return value; }
};

const buildBody = (req, isUpdate = false) => {
  const body = { ...req.body };
  delete body.ownerId;
  delete body.brandCreatorId;
  for (const field of ["price", "compareAtPrice", "stock"]) {
    const parsed = optionalNumber(req.body[field]);
    if (parsed !== undefined) body[field] = parsed;
  }
  if (req.body.salePrice !== undefined && req.body.compareAtPrice === undefined) body.compareAtPrice = optionalNumber(req.body.salePrice);
  delete body.salePrice;
  for (const field of ["trackInventory", "allowBackorder", "liveEnabled", "featured"]) {
    const parsed = optionalBoolean(req.body[field]);
    if (parsed !== undefined) body[field] = parsed;
  }
  for (const field of ["features", "benefits", "aiKeywords", "images"]) {
    const parsed = arrayField(req.body[field]);
    if (parsed !== undefined) body[field] = parsed;
  }
  const specs = objectField(req.body.specifications);
  if (specs !== undefined) body.specifications = specs;
  const uploaded = Array.isArray(req.files) ? req.files.map((f) => f.path || f.secure_url || f.location || f.url).filter(Boolean) : [];
  if (uploaded.length) {
    body.images = isUpdate && Array.isArray(body.images) ? [...new Set([...body.images, ...uploaded])] : uploaded;
    body.thumbnail ||= uploaded[0];
    body.image ||= uploaded[0];
  }
  return body;
};

exports.create = async (req, res) => {
  try {
    const { error, value } = createProductSchema.validate(buildBody(req), { abortEarly: false, stripUnknown: true, convert: true });
    if (error) return validationError(res, error);
    const product = await productService.createProduct(getAccess(req), value);
    return res.status(201).json({ success: true, message: "Product created successfully", product });
  } catch (error) { return handleError(res, error, "Unable to create product"); }
};

exports.list = async (req, res) => {
  try {
    const { error, value } = productListQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: true, convert: true });
    if (error) return validationError(res, error);
    value.ownerId = req.query.ownerId;
    const result = await productService.getProducts(getAccess(req), value);
    return res.json({ success: true, ...result });
  } catch (error) { return handleError(res, error, "Unable to retrieve products"); }
};

exports.single = async (req, res) => {
  try {
    const product = await productService.getProduct(req.params.id, getAccess(req));
    if (!product) return res.status(404).json({ success: false, code: "PRODUCT_NOT_FOUND", message: "Product not found" });
    return res.json({ success: true, product });
  } catch (error) { return handleError(res, error, "Unable to retrieve product"); }
};

exports.update = async (req, res) => {
  try {
    const { error, value } = updateProductSchema.validate(buildBody(req, true), { abortEarly: false, stripUnknown: true, convert: true });
    if (error) return validationError(res, error);
    const product = await productService.updateProduct(req.params.id, getAccess(req), value);
    if (!product) return res.status(404).json({ success: false, code: "PRODUCT_NOT_FOUND", message: "Product not found" });
    return res.json({ success: true, message: "Product updated successfully", product });
  } catch (error) { return handleError(res, error, "Unable to update product"); }
};

exports.remove = async (req, res) => {
  try {
    const product = await productService.deleteProduct(req.params.id, getAccess(req));
    if (!product) return res.status(404).json({ success: false, code: "PRODUCT_NOT_FOUND", message: "Product not found" });
    return res.json({ success: true, message: "Product archived successfully", product });
  } catch (error) { return handleError(res, error, "Unable to archive product"); }
};

exports.restore = async (req, res) => {
  try {
    const product = await productService.restoreProduct(req.params.id, getAccess(req));
    if (!product) return res.status(404).json({ success: false, code: "PRODUCT_NOT_FOUND", message: "Archived product not found" });
    return res.json({ success: true, message: "Product restored successfully", product });
  } catch (error) { return handleError(res, error, "Unable to restore product"); }
};

exports.permanentRemove = async (req, res) => {
  try {
    const product = await productService.permanentlyDeleteProduct(req.params.id, getAccess(req));
    if (!product) return res.status(404).json({ success: false, code: "PRODUCT_NOT_FOUND", message: "Product not found" });
    return res.json({ success: true, message: "Product permanently deleted" });
  } catch (error) { return handleError(res, error, "Unable to permanently delete product"); }
};
