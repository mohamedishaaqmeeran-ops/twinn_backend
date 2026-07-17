const mongoose = require("mongoose");
const Twin = require("../../models/Twin");
const Product = require("../../models/Product");
const KnowledgeChunk = require("../../models/KnowledgeChunk");
const Conversation = require("../../models/Conversation");
const AvatarGeneration = require("../../models/AvatarGeneration");
const embeddingService = require("./embedding.service");
const documentService = require("./document.service");
const speechService = require("./speech.service");
const promptService = require("./twin-prompt.service");
const storageService = require("./storage.service");
const avatarService = require("../avatar/avatar.service");
const MAX = Number(process.env.MAX_KNOWLEDGE_CHUNKS || 500);

const error = (message, statusCode = 500) => { const e = new Error(message); e.statusCode = statusCode; return e; };
const valid = (id, label = "ID") => { if (!id || !mongoose.Types.ObjectId.isValid(id)) throw error(`Invalid ${label}.`, 400); };
const str = (v, fallback = "") => String(v ?? "").trim() || fallback;
const num = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const bool = (v, fallback = false) => [true,"true",1,"1"].includes(v) ? true : [false,"false",0,"0"].includes(v) ? false : fallback;

const getOwnedTwin = async ({ userId, twinId, includeInactive = false }) => {
  valid(userId, "User ID"); valid(twinId, "Twin ID");
  const filter = { _id: twinId, userId };
  if (!includeInactive) filter.status = { $ne: "inactive" };
  const twin = await Twin.findOne(filter);
  if (!twin) throw error("AI Twin not found.", 404);
  return twin;
};
const getOwnedProduct = async ({ userId, productId }) => {
  valid(productId, "Product ID");
  const product = await Product.findOne({ _id: productId, userId });
  if (!product) throw error("Product not found.", 404);
  return product;
};
const upload = async (file, folder, prefix) => file?.buffer ? storageService.uploadBuffer({ buffer: file.buffer, folder, fileName: `${prefix}-${Date.now()}-${file.originalname || "file"}`, mimeType: file.mimetype }) : null;
const recordsFor = async ({ userId, twinId, productId = null, sourceTitle, sourceType, sourceUrl = "", text, file }) => {
  const chunks = documentService.chunkText(text);
  if (!chunks.length) throw error("Unable to create knowledge chunks.", 400);
  if (chunks.length > MAX) throw error(`Knowledge exceeds ${MAX} chunks.`, 400);
  const records = [];
  for (let i = 0; i < chunks.length; i += 1) records.push({ userId, twinId, productId, sourceTitle, sourceType, sourceUrl, content: chunks[i], embedding: await embeddingService.generateDocumentEmbedding(chunks[i]), metadata: { fileName: file?.originalname || "", mimeType: file?.mimetype || "", chunkIndex: i }, status: "ready" });
  return records;
};

exports.getTwinCount = async (userId) => { valid(userId, "User ID"); return Twin.countDocuments({ userId, status: { $ne: "inactive" } }); };
exports.createBasicInfo = async ({ userId, payload = {} }) => {
  valid(userId, "User ID");
  const name = str(payload.name || payload.twinName || payload.twin_name);
  const brandDescription = str(payload.brandDescription || payload.brand_description);
  if (!name) throw error("AI Twin name is required.", 400);
  if (!brandDescription) throw error("Brand description is required.", 400);
  return Twin.create({ userId, name, brandName: str(payload.brandName || payload.brand_name), brandDescription, purpose: str(payload.purpose, "Live-commerce selling and customer support"), industry: str(payload.industry || payload.category, "General"), targetAudience: str(payload.targetAudience || payload.target_audience), personality: str(payload.personality || payload.gesture || payload.style, "Friendly"), tone: str(payload.tone, "Helpful"), primaryLanguage: str(payload.primaryLanguage || payload.language, "English"), currentStep: 2, completedSteps: [1], status: "draft", trainingStatus: "not_started", isTrained: false });
};
exports.saveAppearance = async ({ userId, payload = {}, file }) => {
  const twin = await getOwnedTwin({ userId, twinId: payload.twinId || payload.twin_id || payload.id });
  let avatarUrl = str(payload.avatarUrl || payload.avatar_url), avatarPublicId = str(payload.avatarPublicId || payload.avatar_public_id);
  const result = await upload(file, `twins/${twin._id}/avatar`, "avatar");
  if (result) { avatarUrl = result.url; avatarPublicId = result.publicId; }
  if (!avatarUrl) throw error("Please upload or provide an avatar image.", 400);
  twin.appearance = { ...(twin.appearance?.toObject?.() || twin.appearance || {}), avatarUrl, avatarPublicId, provider: str(payload.avatarProvider || payload.provider, "custom"), style: str(payload.style, "Professional"), background: str(payload.background, "Studio"), clothingStyle: str(payload.clothingStyle || payload.clothing_style, payload.style || "Professional"), gesture: str(payload.gesture || payload.personality, twin.personality || "Friendly") };
  twin.image = avatarUrl; twin.currentStep = Math.max(twin.currentStep || 1, 3); twin.completedSteps = [...new Set([...(twin.completedSteps || []), 2])]; await twin.save(); return twin;
};
exports.saveVoice = async ({ userId, payload = {}, file }) => {
  const twin = await getOwnedTwin({ userId, twinId: payload.twinId || payload.twin_id || payload.id });
  const speed = num(payload.speed, 1), pitch = num(payload.pitch, 1);
  if (speed < .5 || speed > 2) throw error("Voice speed must be between 0.5 and 2.", 400);
  if (pitch < .5 || pitch > 2) throw error("Voice pitch must be between 0.5 and 2.", 400);
  let sampleUrl = str(payload.sampleUrl), samplePublicId = str(payload.samplePublicId);
  const result = await upload(file, `twins/${twin._id}/voice`, "voice"); if (result) { sampleUrl = result.url; samplePublicId = result.publicId; }
  twin.voice = { ...(twin.voice?.toObject?.() || twin.voice || {}), voiceType: str(payload.voiceType || payload.voiceName, "Warm Female"), language: str(payload.language, twin.primaryLanguage || "English"), speed, pitch, sampleUrl, samplePublicId, clonedVoiceId: str(payload.clonedVoiceId), provider: str(payload.voiceProvider, "google"), isCloned: bool(payload.isCloned, false) };
  twin.currentStep = Math.max(twin.currentStep || 1, 4); twin.completedSteps = [...new Set([...(twin.completedSteps || []), 3])]; await twin.save(); return twin;
};
exports.saveKnowledge = async ({ userId, payload = {}, file }) => {
  const twin = await getOwnedTwin({ userId, twinId: payload.twinId || payload.twin_id || payload.id });
  twin.status = "training"; twin.trainingStatus = "processing"; await twin.save();
  try {
    const extracted = await documentService.extractKnowledge({ file, text: payload.text, websiteUrl: payload.websiteUrl || payload.website_url });
    const records = await recordsFor({ userId, twinId: twin._id, sourceTitle: str(payload.title, file?.originalname || `${twin.name} Knowledge`), sourceType: extracted.sourceType, sourceUrl: extracted.sourceUrl, text: extracted.text, file });
    if (bool(payload.replaceExisting, false)) await KnowledgeChunk.deleteMany({ userId, twinId: twin._id, productId: null });
    const chunks = await KnowledgeChunk.insertMany(records);
    Object.assign(twin, { status: "active", trainingStatus: "completed", isTrained: true, currentStep: 6, completedSteps: [...new Set([...(twin.completedSteps || []), 4, 5])] }); await twin.save();
    return { twin, chunks, chunkCount: chunks.length };
  } catch (e) { twin.status = "failed"; twin.trainingStatus = "failed"; await twin.save(); throw e; }
};
exports.trainProduct = async ({ userId, twinId, productId, payload = {}, file }) => {
  const twin = await getOwnedTwin({ userId, twinId }); const product = await getOwnedProduct({ userId, productId });
  twin.status = "training"; twin.trainingStatus = "processing"; await twin.save();
  try {
    let extra = ""; if (file || payload.text?.trim() || payload.websiteUrl) extra = (await documentService.extractKnowledge({ file, text: payload.text, websiteUrl: payload.websiteUrl })).text;
    const text = `PRODUCT NAME:\n${product.name}\n\nDESCRIPTION:\n${product.description || "Not provided"}\n\nCATEGORY:\n${product.category || "General"}\n\nPRICE:\n${product.price ?? product.salePrice ?? "Not provided"}\n\nSTOCK:\n${product.stock ?? product.quantity ?? "Not provided"}\n\nSKU:\n${product.sku || "Not provided"}\n\nFEATURES:\n${Array.isArray(product.features) ? product.features.join("\n") : product.features || "Not provided"}\n\nADDITIONAL KNOWLEDGE:\n${extra || "None"}`;
    const records = await recordsFor({ userId, twinId: twin._id, productId: product._id, sourceTitle: str(payload.title, product.name), sourceType: "product", sourceUrl: str(payload.websiteUrl), text, file });
    await KnowledgeChunk.deleteMany({ userId, twinId: twin._id, productId: product._id }); const chunks = await KnowledgeChunk.insertMany(records);
    if (!(twin.productIds || []).some(id => String(id) === String(product._id))) twin.productIds.push(product._id);
    Object.assign(twin, { status: "active", trainingStatus: "completed", isTrained: true, currentStep: 6, completedSteps: [...new Set([...(twin.completedSteps || []), 5])] }); await twin.save();
    return { twin, product, chunks, chunkCount: chunks.length };
  } catch (e) { twin.status = "failed"; twin.trainingStatus = "failed"; await twin.save(); throw e; }
};
exports.chat = async ({ userId, payload = {} }) => {
  const twin = await getOwnedTwin({ userId, twinId: payload.twinId || payload.twin_id }); const message = str(payload.message); if (!message) throw error("Message is required.", 400);
  let product = null; const productId = payload.productId || payload.product_id;
  if (productId) { product = await getOwnedProduct({ userId, productId }); if (!(twin.productIds || []).some(id => String(id) === String(product._id))) throw error("This product is not trained for the selected AI Twin.", 400); }
  const context = await embeddingService.searchKnowledge({ userId, twinId: twin._id, productId: product?._id || null, query: message });
  let conversation = null;
  if (payload.conversationId) { valid(payload.conversationId, "Conversation ID"); conversation = await Conversation.findOne({ _id: payload.conversationId, userId, twinId: twin._id }); if (!conversation) throw error("Conversation not found.", 404); }
  if (!conversation) conversation = await Conversation.create({ userId, twinId: twin._id, productId: product?._id || null, messages: [] });
  const reply = await promptService.generateReply({ twin, product, message, context, history: conversation.messages.slice(-10) });
  conversation.messages.push({ role: "user", content: message }, { role: "assistant", content: reply }); await conversation.save();
  return { reply, conversationId: conversation._id, twinId: twin._id, productId: product?._id || null, sources: context.map(x => ({ title: x.sourceTitle, content: x.content, score: x.score })) };
};
exports.textToSpeech = async ({ userId, payload = {} }) => speechService.textToSpeech({ text: payload.text, twin: await getOwnedTwin({ userId, twinId: payload.twinId || payload.twin_id }) });
exports.speechToText = async ({ userId, payload = {}, file }) => { const twin = await getOwnedTwin({ userId, twinId: payload.twinId || payload.twin_id }); return speechService.speechToText({ file, language: payload.language || twin.voice?.language || twin.primaryLanguage }); };
exports.speechToSpeech = async ({ userId, payload = {}, file }) => { const twinId = payload.twinId || payload.twin_id; const twin = await getOwnedTwin({ userId, twinId }); const input = await speechService.speechToText({ file, language: payload.language || twin.voice?.language || twin.primaryLanguage }); const chat = await exports.chat({ userId, payload: { twinId, productId: payload.productId || payload.product_id, message: input.transcript, conversationId: payload.conversationId } }); const output = await speechService.textToSpeech({ text: chat.reply, twin }); return { transcript: input.transcript, reply: chat.reply, audioUrl: output.audioUrl, conversationId: chat.conversationId, productId: chat.productId, sources: chat.sources }; };
exports.createTalkingAvatar = async ({ userId, payload = {} }) => { const twin = await getOwnedTwin({ userId, twinId: payload.twinId || payload.twin_id }); const text = str(payload.text || payload.script); if (!text) throw error("Avatar script is required.", 400); if (!twin.appearance?.avatarUrl) throw error("Upload an avatar image first.", 400); let audioUrl = str(payload.audioUrl); if (!audioUrl) audioUrl = (await speechService.textToSpeech({ text, twin })).audioUrl; const generation = await avatarService.createTalkingAvatar({ userId, twin, text, audioUrl }); return { generationId: generation._id, providerGenerationId: generation.providerGenerationId, status: generation.status, audioUrl, videoUrl: generation.videoUrl || "" }; };
exports.getTalkingAvatarStatus = async ({ userId, generationId }) => { valid(generationId, "Generation ID"); const generation = await AvatarGeneration.findOne({ _id: generationId, userId }); if (!generation) throw error("Avatar generation not found.", 404); if (!["completed", "failed"].includes(generation.status)) { const r = await avatarService.getTalkingAvatarStatus({ generation }); Object.assign(generation, { status: r.status, videoUrl: r.videoUrl || generation.videoUrl, error: r.error || "" }); await generation.save(); } return generation; };
exports.getTwins = async (userId) => Twin.find({ userId, status: { $ne: "inactive" } }).populate("productIds", "name description price category images stock").sort({ createdAt: -1 });
exports.getTwin = async ({ userId, twinId }) => (await getOwnedTwin({ userId, twinId })).populate("productIds", "name description price category images stock");
exports.getKnowledge = async ({ userId, twinId, productId = null }) => { await getOwnedTwin({ userId, twinId }); const filter = { userId, twinId, status: "ready" }; if (productId) filter.productId = productId; return KnowledgeChunk.find(filter).select("-embedding").sort({ createdAt: -1 }); };
exports.getConversations = async ({ userId, twinId }) => { await getOwnedTwin({ userId, twinId }); return Conversation.find({ userId, twinId }).sort({ updatedAt: -1 }).limit(50); };
exports.deleteTwin = async ({ userId, twinId }) => { const twin = await getOwnedTwin({ userId, twinId, includeInactive: true }); await Promise.all([KnowledgeChunk.deleteMany({ userId, twinId }), Conversation.deleteMany({ userId, twinId }), AvatarGeneration.deleteMany({ userId, twinId })]); await Twin.deleteOne({ _id: twinId, userId }); return twin; };
exports.getOwnedTwin = getOwnedTwin;
