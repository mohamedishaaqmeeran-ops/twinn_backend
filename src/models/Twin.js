const mongoose =
  require("mongoose");

/* =========================================================
   APPEARANCE SCHEMA
========================================================= */

const appearanceSchema =
  new mongoose.Schema(
    {
      /* =====================================================
         UPLOADED SOURCE IMAGE
      ===================================================== */

      avatarUrl: {
        type: String,
        default: "",
        trim: true,
      },

      avatarPublicId: {
        type: String,
        default: "",
        trim: true,
      },

      /* =====================================================
         GENERATED AVATAR VIDEO
      ===================================================== */

      avatarVideoUrl: {
        type: String,
        default: "",
        trim: true,
      },

      avatarVideoPublicId: {
        type: String,
        default: "",
        trim: true,
      },

      avatarVideoStatus: {
        type: String,

        enum: [
          "idle",
          "queued",
          "processing",
          "completed",
          "failed",
        ],

        default: "idle",
      },

      avatarVideoError: {
        type: String,
        default: "",
        trim: true,
      },

      avatarVideoOperation: {
        type: String,
        default: "",
        trim: true,
      },

      avatarVideoModel: {
        type: String,

        default:
          process.env
            .VEO_VIDEO_MODEL ||
          "veo-3.1-generate-preview",

        trim: true,
      },

      avatarVideoPrompt: {
        type: String,
        default: "",
      },

      /*
       * Exact brand and product speech used
       * for the generated avatar video.
       */

      avatarVideoSpeech: {
        type: String,
        default: "",
      },

      /*
       * Product used for the currently generated
       * avatar video.
       */

      avatarVideoProductId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "Product",

        default: null,
      },

      avatarVideoProductName: {
        type: String,
        default: "",
        trim: true,
      },

      avatarVideoGeneratedAt: {
        type: Date,
        default: null,
      },

      avatarVideoDuration: {
        type: Number,
        default: 8,
        min: 4,
        max: 8,
      },

      avatarVideoAspectRatio: {
        type: String,

        enum: [
          "9:16",
          "16:9",
        ],

        default: "9:16",
      },

      avatarVideoResolution: {
        type: String,

        enum: [
          "720p",
          "1080p",
        ],

        default: "720p",
      },

      /* =====================================================
         AVATAR PROVIDER
      ===================================================== */

      provider: {
        type: String,

        enum: [
          "custom",
          "did",
          "liveavatar",
          "heygen",
          "veo",
        ],

        default: "custom",
      },

      style: {
        type: String,
        default: "Professional",
        trim: true,
      },

      background: {
        type: String,
        default: "Studio",
        trim: true,
      },

      clothingStyle: {
        type: String,
        default: "Professional",
        trim: true,
      },

      gesture: {
        type: String,
        default: "Friendly",
        trim: true,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   VOICE SCHEMA
========================================================= */

const voiceSchema =
  new mongoose.Schema(
    {
      voiceType: {
        type: String,
        default: "Warm Female",
        trim: true,
      },

      language: {
        type: String,
        default: "English",
        trim: true,
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

      sampleUrl: {
        type: String,
        default: "",
        trim: true,
      },

      samplePublicId: {
        type: String,
        default: "",
        trim: true,
      },

      clonedVoiceId: {
        type: String,
        default: "",
        trim: true,
      },

      provider: {
        type: String,

        enum: [
          "google",
          "elevenlabs",
          "azure",
          "custom",
        ],

        default: "google",
      },

      isCloned: {
        type: Boolean,
        default: false,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   TWIN SCHEMA
========================================================= */

const twinSchema =
  new mongoose.Schema(
    {
      userId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "User",

        required: true,

        index: true,
      },

      name: {
        type: String,
        required: true,
        trim: true,
      },

      brandName: {
        type: String,
        default: "",
        trim: true,
      },

      brandDescription: {
        type: String,
        required: true,
        trim: true,
      },

      purpose: {
        type: String,

        default:
          "Live-commerce selling and customer support",

        trim: true,
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
        type:
          appearanceSchema,

        default: () => ({}),
      },

      voice: {
        type:
          voiceSchema,

        default: () => ({}),
      },

      /*
       * Products assigned to this AI Twin.
       */

      productIds: [
        {
          type:
            mongoose.Schema.Types
              .ObjectId,

          ref: "Product",
        },
      ],

      currentStep: {
        type: Number,
        default: 1,
      },

      completedSteps: {
        type: [Number],
        default: [],
      },

      status: {
        type: String,

        enum: [
          "draft",
          "training",
          "active",
          "failed",
          "inactive",
        ],

        default: "draft",
      },

      trainingStatus: {
        type: String,

        enum: [
          "not_started",
          "processing",
          "completed",
          "failed",
        ],

        default:
          "not_started",
      },

      isTrained: {
        type: Boolean,
        default: false,
      },
    },
    {
      timestamps: true,
    }
  );

/* =========================================================
   INDEXES
========================================================= */

twinSchema.index({
  userId: 1,
  status: 1,
});

twinSchema.index({
  userId: 1,
  "appearance.avatarVideoStatus":
    1,
});

twinSchema.index({
  userId: 1,
  productIds: 1,
});

twinSchema.index({
  userId: 1,
  "appearance.avatarVideoProductId":
    1,
});

/* =========================================================
   JSON TRANSFORM
========================================================= */

twinSchema.set(
  "toJSON",
  {
    transform: (
      document,
      object
    ) => {
      delete object.__v;

      return object;
    },
  }
);

twinSchema.set(
  "toObject",
  {
    transform: (
      document,
      object
    ) => {
      delete object.__v;

      return object;
    },
  }
);

/* =========================================================
   EXPORT
========================================================= */

module.exports =
  mongoose.models.Twin ||
  mongoose.model(
    "Twin",
    twinSchema
  );