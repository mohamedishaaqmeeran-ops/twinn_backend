const axios = require("axios");

const API_BASE_URL =
  process.env.DID_API_BASE_URL ||
  "https://api.d-id.com";

const didApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: Number(
    process.env.DID_REQUEST_TIMEOUT_MS ||
      30000
  ),
});

const getAuthorization = () => {
  const apiKey = String(
    process.env.DID_API_KEY || ""
  ).trim();

  if (!apiKey) {
    const error = new Error(
      "DID_API_KEY is not configured."
    );

    error.statusCode = 500;

    throw error;
  }

  /*
   * D-ID keys are commonly stored as:
   * username:password
   *
   * In that case the HTTP header is:
   * Basic <base64(username:password)>
   *
   * Some dashboards provide the already
   * encoded value. Set DID_API_KEY_IS_BASE64=true
   * when your environment contains that value.
   */
  const isBase64 =
    String(
      process.env.DID_API_KEY_IS_BASE64 ||
        "false"
    ).toLowerCase() === "true";

  const encoded = isBase64
    ? apiKey
    : Buffer.from(apiKey).toString(
        "base64"
      );

  return `Basic ${encoded}`;
};

const getHeaders = () => ({
  Authorization: getAuthorization(),
  "Content-Type": "application/json",
});

const normalizeProviderError = (
  error,
  fallbackMessage
) => {
  const message =
    error?.response?.data?.description ||
    error?.response?.data?.message ||
    error?.response?.data?.error
      ?.description ||
    error?.message ||
    fallbackMessage;

  const normalized = new Error(message);

  normalized.statusCode =
    error?.response?.status || 502;

  normalized.providerResponse =
    error?.response?.data || null;

  return normalized;
};

/* =========================================================
   RECORDED TALK
========================================================= */

exports.createTalk = async ({
  imageUrl,
  audioUrl,
}) => {
  try {
    const response =
      await didApi.post(
        "/talks",
        {
          source_url: imageUrl,

          script: {
            type: "audio",
            audio_url: audioUrl,
          },

          config: {
            fluent: true,
            pad_audio: 0,
          },
        },
        {
          headers: getHeaders(),
        }
      );

    return response.data;
  } catch (error) {
    throw normalizeProviderError(
      error,
      "Unable to create D-ID talk."
    );
  }
};

exports.getTalk = async ({
  talkId,
}) => {
  try {
    const response =
      await didApi.get(
        `/talks/${talkId}`,
        {
          headers: getHeaders(),
        }
      );

    return response.data;
  } catch (error) {
    throw normalizeProviderError(
      error,
      "Unable to load D-ID talk."
    );
  }
};

/* =========================================================
   STREAMING AVATAR
========================================================= */

exports.createStream = async ({
  avatarUrl,
}) => {
  try {
    const response =
      await didApi.post(
        "/talks/streams",
        {
          source_url: avatarUrl,
        },
        {
          headers: getHeaders(),
        }
      );

    return response.data;
  } catch (error) {
    throw normalizeProviderError(
      error,
      "Unable to create D-ID stream."
    );
  }
};

exports.submitSdpAnswer = async ({
  streamId,
  sessionId,
  answer,
}) => {
  try {
    const response =
      await didApi.post(
        `/talks/streams/${streamId}/sdp`,
        {
          answer,
          session_id: sessionId,
        },
        {
          headers: getHeaders(),
        }
      );

    return response.data;
  } catch (error) {
    throw normalizeProviderError(
      error,
      "Unable to submit D-ID SDP answer."
    );
  }
};

exports.addIceCandidate = async ({
  streamId,
  sessionId,
  candidate,
  sdpMid,
  sdpMLineIndex,
}) => {
  try {
    const response =
      await didApi.post(
        `/talks/streams/${streamId}/ice`,
        {
          candidate,
          sdpMid,
          sdpMLineIndex,
          session_id: sessionId,
        },
        {
          headers: getHeaders(),
        }
      );

    return response.data;
  } catch (error) {
    throw normalizeProviderError(
      error,
      "Unable to add D-ID ICE candidate."
    );
  }
};

const voiceMap = {
  English: "en-US-JennyNeural",
  Tamil: "ta-IN-PallaviNeural",
  Hindi: "hi-IN-SwaraNeural",
  Malayalam: "ml-IN-SobhanaNeural",
  Arabic: "ar-AE-FatimaNeural",
  Telugu: "te-IN-ShrutiNeural",
  Kannada: "kn-IN-SapnaNeural",
};

exports.speakText = async ({
  streamId,
  sessionId,
  text,
  language = "English",
}) => {
  try {
    const response =
      await didApi.post(
        `/talks/streams/${streamId}`,
        {
          script: {
            type: "text",
            input: text,

            provider: {
              type: "microsoft",

              voice_id:
                voiceMap[language] ||
                voiceMap.English,
            },
          },

          config: {
            fluent: true,
            pad_audio: 0,
          },

          session_id: sessionId,
        },
        {
          headers: getHeaders(),
        }
      );

    return response.data;
  } catch (error) {
    throw normalizeProviderError(
      error,
      "Unable to make D-ID avatar speak."
    );
  }
};

exports.speakAudio = async ({
  streamId,
  sessionId,
  audioUrl,
}) => {
  try {
    const response =
      await didApi.post(
        `/talks/streams/${streamId}`,
        {
          script: {
            type: "audio",
            audio_url: audioUrl,
          },

          config: {
            fluent: true,
            pad_audio: 0,
          },

          session_id: sessionId,
        },
        {
          headers: getHeaders(),
        }
      );

    return response.data;
  } catch (error) {
    throw normalizeProviderError(
      error,
      "Unable to play audio through D-ID avatar."
    );
  }
};

exports.deleteStream = async ({
  streamId,
  sessionId,
}) => {
  try {
    const response =
      await didApi.delete(
        `/talks/streams/${streamId}`,
        {
          headers: getHeaders(),

          data: {
            session_id: sessionId,
          },
        }
      );

    return response.data;
  } catch (error) {
    throw normalizeProviderError(
      error,
      "Unable to close D-ID stream."
    );
  }
};
