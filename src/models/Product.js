const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    twinId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Twin",
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, trim: true, lowercase: true, maxlength: 180 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    shortDescription: { type: String, trim: true, default: "", maxlength: 300 },
    category: { type: String, trim: true, default: "General", index: true },
    brand: { type: String, trim: true, default: "" },
    sku: { type: String, trim: true, uppercase: true, default: undefined },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, default: null, min: 0 },
    currency: { type: String, trim: true, uppercase: true, default: "INR", maxlength: 3 },
    stock: { type: Number, min: 0, default: 0 },
    trackInventory: { type: Boolean, default: true },
    allowBackorder: { type: Boolean, default: false },
    thumbnail: { type: String, default: "" },
    image: { type: String, default: "" },
    images: { type: [String], default: [], validate: [(v) => v.length <= 5, "Maximum 5 images"] },
    video: { type: String, default: "" },
    features: { type: [String], default: [] },
    benefits: { type: [String], default: [] },
    specifications: { type: Map, of: String, default: {} },
    shippingInformation: { type: String, default: "" },
    returnPolicy: { type: String, default: "" },
    warranty: { type: String, default: "" },
    aiKeywords: { type: [String], default: [] },
    liveEnabled: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["draft", "active", "inactive", "archived"],
      default: "draft",
      index: true,
    },
    trainingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

productSchema.index({ userId: 1, sku: 1 }, { unique: true, sparse: true });
productSchema.index({ name: "text", description: "text", brand: "text", category: "text", sku: "text" });

productSchema.pre("validate", function validatePrices(next) {
  if (
    this.compareAtPrice !== null &&
    this.compareAtPrice !== undefined &&
    this.compareAtPrice < this.price
  ) {
    return next(new Error("Compare-at price must be greater than or equal to product price"));
  }
  next();
});

module.exports = mongoose.models.Product || mongoose.model("Product", productSchema);
