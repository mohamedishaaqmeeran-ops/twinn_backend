const mongoose =
  require("mongoose");

/* =========================================================
   APPEARANCE SCHEMA
========================================================= */

const appearanceSchema =
  new mongoose.Schema(
    {
      /* Uploaded source image */

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

      /* Generated motion video */

     avatarVideoUrl: {
  type: String,
  default: "",
},

avatarVideoPublicId: {
  type: String,
  default: "",
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
},

avatarVideoOperation: {
  type: String,
  default: "",
},
      avatarVideoModel: {
        type: String,

        default:
          "veo-3.1-generate-001",

        trim: true,
      },

      avatarVideoPrompt: {
        type: String,
        default: "",
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

      /* Avatar provider */

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
  "appearance.avatarVideoStatus": 1,
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