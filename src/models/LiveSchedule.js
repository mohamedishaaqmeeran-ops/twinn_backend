const mongoose = require("mongoose");

const platformResultSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["instagram", "facebook", "youtube", "tiktok"],
      required: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "starting",
        "live",
        "completed",
        "failed",
        "skipped",
      ],
      default: "pending",
    },

    startedAt: Date,
    completedAt: Date,

    error: String,

    liveVideoId: String,
    streamUrl: String,
  },
  {
    _id: false,
  }
);

const liveScheduleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    product: {
      type: String,
      default: "",
    },

    productName: {
      type: String,
      default: "",
    },

    videoPath: {
      type: String,
      required: true,
    },
    instagramRtmpUrl: {
  type: String,
  default: "",
  select: false,
},

instagramStreamKey: {
  type: String,
  default: "",
  select: false,
},

    platforms: [
      {
        type: String,
        enum: ["instagram", "facebook", "youtube", "tiktok"],
      },
    ],

    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    endsAt: {
  type: Date,
  default: null,
  index: true,
},

    timezone: {
      type: String,
      default: "Asia/Kolkata",
    },

    durationMinutes: {
      type: Number,
      default: 30,
      min: 1,
      max: 480,
    },

    status: {
      type: String,
      enum: [
        "Upcoming",
        "Starting",
        "Live",
        "Completed",
        "Cancelled",
        "Failed",
      ],
      default: "Upcoming",
      index: true,
    },

    platformResults: {
      type: [platformResultSchema],
      default: [],
    },

    startedAt: Date,
    completedAt: Date,

    lastError: String,

    lockedAt: Date,

    isProcessing: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

liveScheduleSchema.index({
  status: 1,
  scheduledAt: 1,
  isProcessing: 1,
  endsAt: 1,
});

module.exports = mongoose.model(
  "LiveSchedule",
  liveScheduleSchema
);