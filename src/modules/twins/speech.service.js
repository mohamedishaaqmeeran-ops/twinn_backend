const { TextToSpeechClient } = require("@google-cloud/text-to-speech");
const { SpeechClient } = require("@google-cloud/speech");
const storageService = require("./storage.service");
const tts = new TextToSpeechClient();
const stt = new SpeechClient();
const languages = { English: "en-US", Tamil: "ta-IN", Hindi: "hi-IN", Malayalam: "ml-IN", Arabic: "ar-XA", Telugu: "te-IN", Kannada: "kn-IN" };
const encodings = { "audio/webm": "WEBM_OPUS", "audio/ogg": "OGG_OPUS", "audio/wav": "LINEAR16", "audio/x-wav": "LINEAR16", "audio/mpeg": "MP3", "audio/mp3": "MP3" };
exports.textToSpeech = async ({ text, twin }) => {
  if (!text?.trim()) { const e = new Error("Text is required."); e.statusCode = 400; throw e; }
  const languageCode = languages[twin.voice?.language] || languages[twin.primaryLanguage] || "en-US";
  const [response] = await tts.synthesizeSpeech({ input: { text: text.trim() }, voice: { languageCode, ssmlGender: String(twin.voice?.voiceType || "").toLowerCase().includes("male") ? "MALE" : "FEMALE" }, audioConfig: { audioEncoding: "MP3", speakingRate: Number(twin.voice?.speed || 1), pitch: (Number(twin.voice?.pitch || 1) - 1) * 10 } });
  const uploaded = await storageService.uploadBuffer({ buffer: response.audioContent, folder: `twins/${twin._id}/speech`, fileName: `speech-${Date.now()}.mp3`, mimeType: "audio/mpeg" });
  return { text: text.trim(), audioUrl: uploaded.url, publicId: uploaded.publicId };
};
exports.speechToText = async ({ file, language }) => {
  if (!file?.buffer) { const e = new Error("Audio file is required."); e.statusCode = 400; throw e; }
  const [response] = await stt.recognize({ audio: { content: file.buffer.toString("base64") }, config: { encoding: encodings[file.mimetype] || "WEBM_OPUS", languageCode: languages[language] || "en-US", enableAutomaticPunctuation: true } });
  const transcript = (response.results || []).map(r => r.alternatives?.[0]?.transcript || "").join(" ").trim();
  if (!transcript) { const e = new Error("No speech was recognized."); e.statusCode = 400; throw e; }
  return { transcript };
};
