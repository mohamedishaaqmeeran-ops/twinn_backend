const mongoose = require("mongoose");

const Twin = require("../../models/Twin");

const KnowledgeChunk =
  require("../../models/KnowledgeChunk");

const TwinConversation =
  require("../../models/TwinConversation");

const storageService =
  require("./storage.service");

const documentService =
  require("./document.service");

const embeddingService =
  require("./embedding.service");

const chatService =
  require("./chat.service");

const validateObjectId = (
  id,
  fieldName = "Twin ID"
) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error(
      `Invalid ${fieldName}.`
    );

    error.statusCode = 400;

    throw error;
  }
};

const findOwnedTwin = async ({
  userId,
  twinId,
}) => {
  validateObjectId(twinId);

  const twin = await Twin.findOne({
    _id: twinId,
    userId,
  });

  if (!twin) {
    const error = new Error(
      "AI Twin not found."
    );

    error.statusCode = 404;

    throw error;
  }

  return twin;
};

const addCompletedStep = (
  twin,
  step
) => {
  if (!twin.completedSteps.includes(step)) {
    twin.completedSteps.push(step);
  }
};

const normalizeTwinId = (payload = {}) =>
  payload.twinId ||
  payload.twin_id ||
  payload.id ||
  "";

exports.createBasicInfo = async ({
  userId,
  payload,
}) => {
  const name = String(
    payload.name ||
      payload.twinName ||
      payload.twin_name ||
      ""
  ).trim();

  const brandDescription = String(
    payload.brandDescription ||
      payload.brand_description ||
      ""
  ).trim();

  if (!name) {
    throw new Error(
      "AI Twin name is required."
    );
  }

  if (!brandDescription) {
    throw new Error(
      "Brand description is required."
    );
  }

  return Twin.create({
    userId,
    name,

    brandName: String(
      payload.brandName ||
        payload.brand_name ||
        ""
    ).trim(),

    brandDescription,

    purpose: String(
      payload.purpose || ""
    ).trim(),

    industry: String(
      payload.industry ||
        payload.category ||
        "General"
    ).trim(),

    targetAudience: String(
      payload.targetAudience ||
        payload.target_audience ||
        ""
    ).trim(),

    personality: String(
      payload.personality ||
        payload.style ||
        "Friendly"
    ).trim(),

    tone: String(
      payload.tone || "Helpful"
    ).trim(),

    primaryLanguage: String(
      payload.primaryLanguage ||
        payload.language ||
        "English"
    ).trim(),

    currentStep: 2,
    completedSteps: [1],
    status: "draft",
  });
};

exports.saveAppearance = async ({
  userId,
  payload,
  file,
}) => {
  const twinId =
    normalizeTwinId(payload);

  const twin =
    await findOwnedTwin({
      userId,
      twinId,
    });

  let avatarUrl = String(
    payload.avatarUrl ||
      payload.avatar_url ||
      twin.appearance?.avatarUrl ||
      ""
  ).trim();

  let avatarPublicId =
    twin.appearance?.avatarPublicId ||
    "";

  if (file) {
    const uploaded =
      await storageService.uploadAvatar({
        userId,
        twinId,
        file,
      });

    avatarUrl = uploaded.url;
    avatarPublicId =
      uploaded.publicId;
  }

  if (!avatarUrl) {
    throw new Error(
      "Upload an avatar or provide avatarUrl."
    );
  }

  twin.appearance = {
    avatarUrl,
    avatarPublicId,

    style:
      payload.style ||
      twin.appearance?.style ||
      "Professional",

    background:
      payload.background ||
      twin.appearance?.background ||
      "",

    gender:
      payload.gender ||
      twin.appearance?.gender ||
      "",

    ageGroup:
      payload.ageGroup ||
      payload.age_group ||
      twin.appearance?.ageGroup ||
      "",

    skinTone:
      payload.skinTone ||
      payload.skin_tone ||
      twin.appearance?.skinTone ||
      "",

    hairStyle:
      payload.hairStyle ||
      payload.hair_style ||
      twin.appearance?.hairStyle ||
      "",

    clothingStyle:
      payload.clothingStyle ||
      payload.clothing_style ||
      twin.appearance
        ?.clothingStyle ||
      "",
  };

  twin.image = avatarUrl;
  twin.currentStep = Math.max(
    twin.currentStep,
    3
  );

  addCompletedStep(twin, 2);

  await twin.save();

  return twin;
};

exports.saveVoice = async ({
  userId,
  payload,
  file,
}) => {
  const twinId =
    normalizeTwinId(payload);

  const twin =
    await findOwnedTwin({
      userId,
      twinId,
    });

  let sampleUrl = String(
    payload.sampleUrl ||
      payload.sample_url ||
      twin.voice?.sampleUrl ||
      ""
  ).trim();

  let samplePublicId =
    twin.voice?.samplePublicId ||
    "";

  if (file) {
    const uploaded =
      await storageService.uploadVoiceSample({
        userId,
        twinId,
        file,
      });

    sampleUrl = uploaded.url;
    samplePublicId =
      uploaded.publicId;
  }

  const speed =
    Number(payload.speed || 1);

  const pitch =
    Number(payload.pitch || 1);

  if (speed < 0.5 || speed > 2) {
    throw new Error(
      "Voice speed must be between 0.5 and 2."
    );
  }

  if (pitch < 0.5 || pitch > 2) {
    throw new Error(
      "Voice pitch must be between 0.5 and 2."
    );
  }

  const voiceType = String(
    payload.voiceType ||
      payload.voice_type ||
      payload.voiceName ||
      payload.voice ||
      "Warm Female"
  ).trim();

  twin.voice = {
    voiceType,

    voiceId: String(
      payload.voiceId ||
        payload.voice_id ||
        ""
    ).trim(),

    language: String(
      payload.language ||
        twin.primaryLanguage ||
        "English"
    ).trim(),

    sampleUrl,
    samplePublicId,
    speed,
    pitch,
  };

  twin.voiceName = voiceType;
  twin.currentStep = Math.max(
    twin.currentStep,
    4
  );

  addCompletedStep(twin, 3);

  await twin.save();

  return twin;
};

const saveKnowledgeChunks = async ({
  userId,
  twin,
  sourceType,
  sourceTitle,
  sourceUrl = "",
  fileDetails = {},
  text,
}) => {
  const chunks =
    documentService.chunkText(text);

  if (!chunks.length) {
    throw new Error(
      "No readable knowledge content was found."
    );
  }

  const currentCount =
    await KnowledgeChunk.countDocuments({
      twinId: twin._id,
    });

  const maxChunks = Number(
    process.env.MAX_KNOWLEDGE_CHUNKS ||
      500
  );

  if (
    currentCount + chunks.length >
    maxChunks
  ) {
    throw new Error(
      `Knowledge limit exceeded. Maximum ${maxChunks} chunks are allowed per twin.`
    );
  }

  const savedChunks = [];

  for (
    let index = 0;
    index < chunks.length;
    index += 1
  ) {
    const content = chunks[index];

    const embedding =
      await embeddingService.generateDocumentEmbedding({
        title: sourceTitle,
        content,
      });

    const saved =
      await KnowledgeChunk.create({
        userId,
        twinId: twin._id,
        sourceType,
        sourceTitle,
        sourceUrl,

        fileName:
          fileDetails.fileName ||
          "",

        fileUrl:
          fileDetails.fileUrl ||
          "",

        filePublicId:
          fileDetails.filePublicId ||
          "",

        mimeType:
          fileDetails.mimeType ||
          "",

        chunkIndex: index,
        content,
        embedding,

        embeddingModel:
          embeddingService.embeddingModel,

        status: "ready",
      });

    savedChunks.push(saved);
  }

  twin.knowledgeCount +=
    savedChunks.length;

  twin.trainingStatus =
    "completed";

  twin.isTrained = true;

  twin.status = "active";

  twin.currentStep = Math.max(
    twin.currentStep,
    6
  );

  addCompletedStep(twin, 4);
  addCompletedStep(twin, 5);

  await twin.save();

  return savedChunks;
};

exports.saveKnowledge = async ({
  userId,
  payload,
  file,
}) => {
  const twinId =
    normalizeTwinId(payload);

  const twin =
    await findOwnedTwin({
      userId,
      twinId,
    });

  twin.trainingStatus =
    "processing";

  await twin.save();

  try {
    let sourceType = String(
      payload.type || "text"
    ).toLowerCase();

    let sourceTitle = String(
      payload.title ||
        "Training Knowledge"
    ).trim();

    let sourceUrl = "";
    let text = "";

    const fileDetails = {};

    if (file) {
      sourceType = "file";
      sourceTitle =
        sourceTitle ||
        file.originalname;

      text =
        await documentService.extractTextFromFile(
          file
        );

      const uploaded =
        await storageService.uploadKnowledgeFile({
          userId,
          twinId,
          file,
        });

      fileDetails.fileName =
        file.originalname;

      fileDetails.fileUrl =
        uploaded.url;

      fileDetails.filePublicId =
        uploaded.publicId;

      fileDetails.mimeType =
        file.mimetype;
    } else if (
      payload.websiteUrl ||
      payload.website_url
    ) {
      sourceType = "website";

      sourceUrl = String(
        payload.websiteUrl ||
          payload.website_url
      ).trim();

      const website =
        await documentService.extractTextFromWebsite(
          sourceUrl
        );

      sourceTitle =
        payload.title ||
        website.title;

      text = website.text;
    } else {
      text = String(
        payload.text ||
          payload.content ||
          payload.trainingText ||
          payload.training_text ||
          ""
      ).trim();
    }

    if (!text) {
      throw new Error(
        "Provide knowledge text, a document or website URL."
      );
    }

    const chunks =
      await saveKnowledgeChunks({
        userId,
        twin,
        sourceType,
        sourceTitle,
        sourceUrl,
        fileDetails,
        text,
      });

    return {
      twin,
      chunks,
      chunkCount: chunks.length,
    };
  } catch (error) {
    twin.trainingStatus = "failed";

    await twin.save();

    throw error;
  }
};

exports.chat = async ({
  userId,
  payload,
}) => {
  const twinId =
    normalizeTwinId(payload);

  validateObjectId(twinId);

  return chatService.chat({
    userId,
    twinId,

    message:
      payload.message,

    conversationId:
      payload.conversationId ||
      payload.conversation_id,
  });
};

exports.getTwins = async (
  userId
) => {
  return Twin.find({
    userId,
  }).sort({
    createdAt: -1,
  });
};

exports.getTwin = async ({
  userId,
  twinId,
}) => {
  return findOwnedTwin({
    userId,
    twinId,
  });
};

exports.getKnowledge = async ({
  userId,
  twinId,
}) => {
  await findOwnedTwin({
    userId,
    twinId,
  });

  return KnowledgeChunk.find({
    userId,
    twinId,
  })
    .select("-embedding")
    .sort({
      createdAt: -1,
      chunkIndex: 1,
    });
};

exports.getConversations = async ({
  userId,
  twinId,
}) => {
  await findOwnedTwin({
    userId,
    twinId,
  });

  return TwinConversation.find({
    userId,
    twinId,
  })
    .sort({
      updatedAt: -1,
    })
    .limit(50);
};

exports.deleteTwin = async ({
  userId,
  twinId,
}) => {
  const twin =
    await findOwnedTwin({
      userId,
      twinId,
    });

  await Promise.all([
    KnowledgeChunk.deleteMany({
      userId,
      twinId,
    }),

    TwinConversation.deleteMany({
      userId,
      twinId,
    }),
  ]);

  await twin.deleteOne();

  return twin;
};

exports.getTwinCount = async (
  userId
) => {
  return Twin.countDocuments({
    userId,
    status: {
      $ne: "inactive",
    },
  });
};