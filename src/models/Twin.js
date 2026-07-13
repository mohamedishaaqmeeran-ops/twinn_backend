const mongoose = require("mongoose");

const twinSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    brandName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 150,
    },

    brandDescription: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },

    purpose: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1500,
    },

    industry: {
      type: String,
      default: "General",
      trim: true,
    },

    targetAudience: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1500,
    },

    personality: {
      type: String,
      default: "Friendly",
      trim: true,
    },

    tone: {
      type: String,
      default: "Helpful",
      trim: true,
    },

    primaryLanguage: {
      type: String,
      default: "English",
      trim: true,
    },

    appearance: {
      avatarUrl: {
        type: String,
        default: "",
      },

      avatarPublicId: {
        type: String,
        default: "",
      },

      style: {
        type: String,
        default: "Professional",
      },

      background: {
        type: String,
        default: "",
      },

      gender: {
        type: String,
        default: "",
      },

      ageGroup: {
        type: String,
        default: "",
      },

      skinTone: {
        type: String,
        default: "",
      },

      hairStyle: {
        type: String,
        default: "",
      },

      clothingStyle: {
        type: String,
        default: "",
      },
    },

    image: {
      type: String,
      default: "/images/bb.png",
    },

    voice: {
      voiceType: {
        type: String,
        default: "Warm Female",
      },

      voiceId: {
        type: String,
        default: "",
      },

      language: {
        type: String,
        default: "English",
      },

      sampleUrl: {
        type: String,
        default: "",
      },

      samplePublicId: {
        type: String,
        default: "",
      },

      speed: {
        type: Number,
        default: 1,
        min: 0.5,
        max: 2,
      },

      pitch: {
        type: Number,
        default: 1,
        min: 0.5,
        max: 2,
      },
    },

    voiceName: {
      type: String,
      default: "Warm Female",
    },

    trainingStatus: {
      type: String,
      enum: [
        "not_started",
        "processing",
        "completed",
        "failed",
      ],
      default: "not_started",
    },

    isTrained: {
      type: Boolean,
      default: false,
    },

    knowledgeCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    currentStep: {
      type: Number,
      default: 1,
      min: 1,
      max: 6,
    },

    completedSteps: {
      type: [Number],
      default: [],
    },

    status: {
      type: String,
      enum: ["draft", "active", "inactive"],
      default: "draft",
    },
  },
  {
    timestamps: true,
  }
);

twinSchema.index({
  userId: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Twin", twinSchema);