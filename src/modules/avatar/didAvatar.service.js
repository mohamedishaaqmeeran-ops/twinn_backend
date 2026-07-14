const DID_API_URL = String(
  process.env.DID_API_URL ||
    "https://api.d-id.com"
).replace(/\/+$/, "");

const DEFAULT_DRIVER_URL =
  process.env.DID_DRIVER_URL ||
  "bank://lively/driver-06";

const DEFAULT_VOICE_ID =
  process.env.DID_VOICE_ID ||
  "en-US-JennyNeural";

/* =========================================================
   HEADERS
========================================================= */

const getHeaders = () => {
  const apiKey = String(
    process.env.DID_API_KEY || ""
  ).trim();

  if (!apiKey) {
    throw new Error(
      "DID_API_KEY is missing."
    );
  }

  return {
    Authorization: apiKey.startsWith(
      "Basic "
    )
      ? apiKey
      : `Basic ${apiKey}`,

    Accept: "application/json",

    "Content-Type":
      "application/json",
  };
};

/* =========================================================
   RESPONSE PARSER
========================================================= */

const parseResponse = async (
  response
) => {
  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  const data =
    contentType.includes(
      "application/json"
    )
      ? await response
          .json()
          .catch(() => ({}))
      : {
          message: await response
            .text()
            .catch(() => ""),
        };

  if (!response.ok) {
    console.error(
      "D-ID API ERROR:",
      {
        url: response.url,
        status:
          response.status,
        statusText:
          response.statusText,
        data,
      }
    );

    const error = new Error(
      data?.description ||
        data?.message ||
        data?.kind ||
        `D-ID request failed (${response.status}).`
    );

    error.statusCode =
      response.status;

    error.details = data;

    throw error;
  }

  return data;
};

/* =========================================================
   TEST CREDITS
========================================================= */

exports.getCredits =
  async () => {
    const response =
      await fetch(
        `${DID_API_URL}/credits`,
        {
          method: "GET",
          headers:
            getHeaders(),
        }
      );

    return parseResponse(
      response
    );
  };

/* =========================================================
   CREATE TALKS WEBRTC STREAM
========================================================= */

exports.createStream =
  async ({
    avatarUrl,
  }) => {
    const normalizedAvatarUrl =
      String(
        avatarUrl || ""
      ).trim();

    if (!normalizedAvatarUrl) {
      throw new Error(
        "Avatar image URL is required."
      );
    }

    console.log(
      "CREATING D-ID STREAM:",
      {
        avatarUrl:
          normalizedAvatarUrl,
        driverUrl:
          DEFAULT_DRIVER_URL,
      }
    );

    const response =
      await fetch(
        `${DID_API_URL}/talks/streams`,
        {
          method: "POST",

          headers:
            getHeaders(),

          body:
            JSON.stringify({
              source_url:
                normalizedAvatarUrl,

              /*
               * Keep the same driver for
               * stream creation and speech.
               */
              driver_url:
                DEFAULT_DRIVER_URL,

              config: {
                fluent: true,

                /*
                 * VP8 generally has better
                 * browser compatibility.
                 */
                stitch: true,
              },
            }),
        }
      );

    const result =
      await parseResponse(
        response
      );

    console.log(
      "D-ID STREAM CREATED:",
      {
        streamId:
          result?.id,
        hasSessionId:
          Boolean(
            result?.session_id
          ),
        hasOffer:
          Boolean(
            result?.offer
          ),
        iceServers:
          result?.ice_servers
            ?.length || 0,
      }
    );

    return result;
  };

/* =========================================================
   SUBMIT SDP ANSWER
========================================================= */

exports.submitSdpAnswer =
  async ({
    streamId,
    sessionId,
    answer,
  }) => {
    if (
      !streamId ||
      !sessionId
    ) {
      throw new Error(
        "D-ID stream ID and session ID are required."
      );
    }

    if (
      !answer?.type ||
      !answer?.sdp
    ) {
      throw new Error(
        "A valid WebRTC SDP answer is required."
      );
    }

    const response =
      await fetch(
        `${DID_API_URL}/talks/streams/${streamId}/sdp`,
        {
          method: "POST",

          headers:
            getHeaders(),

          body:
            JSON.stringify({
              answer: {
                type:
                  answer.type,
                sdp:
                  answer.sdp,
              },

              session_id:
                sessionId,
            }),
        }
      );

    const result =
      await parseResponse(
        response
      );

    console.log(
      "D-ID SDP ACCEPTED:",
      streamId
    );

    return result;
  };

/* =========================================================
   ADD ICE CANDIDATE
========================================================= */

exports.addIceCandidate =
  async ({
    streamId,
    sessionId,
    candidate,
    sdpMid,
    sdpMLineIndex,
  }) => {
    if (
      !streamId ||
      !sessionId
    ) {
      throw new Error(
        "D-ID stream ID and session ID are required."
      );
    }

    const response =
      await fetch(
        `${DID_API_URL}/talks/streams/${streamId}/ice`,
        {
          method: "POST",

          headers:
            getHeaders(),

          body:
            JSON.stringify({
              candidate:
                candidate ?? null,

              sdpMid:
                sdpMid ?? null,

              sdpMLineIndex:
                sdpMLineIndex ??
                null,

              session_id:
                sessionId,
            }),
        }
      );

    return parseResponse(
      response
    );
  };

/* =========================================================
   SELECT VOICE
========================================================= */

const getVoiceId = (
  language
) => {
  const normalized =
    String(
      language || ""
    ).toLowerCase();

  if (
    normalized.includes(
      "tamil"
    )
  ) {
    return "ta-IN-PallaviNeural";
  }

  if (
    normalized.includes(
      "malayalam"
    )
  ) {
    return "ml-IN-SobhanaNeural";
  }

  if (
    normalized.includes(
      "hindi"
    )
  ) {
    return "hi-IN-SwaraNeural";
  }

  if (
    normalized.includes(
      "arabic"
    )
  ) {
    return "ar-AE-FatimaNeural";
  }

  return DEFAULT_VOICE_ID;
};

/* =========================================================
   MAKE AVATAR SPEAK
========================================================= */

exports.speakText =
  async ({
    streamId,
    sessionId,
    text,
    language = "English",
    voiceId,
  }) => {
    const normalizedText =
      String(
        text || ""
      ).trim();

    if (!normalizedText) {
      throw new Error(
        "Avatar speech text is required."
      );
    }

    if (
      !streamId ||
      !sessionId
    ) {
      throw new Error(
        "D-ID stream ID and session ID are required."
      );
    }

    const selectedVoiceId =
      voiceId ||
      getVoiceId(language);

    const requestBody = {
      session_id:
        sessionId,

      driver_url:
        DEFAULT_DRIVER_URL,

      script: {
        type: "text",

        input:
          normalizedText,

        provider: {
          type: "microsoft",

          voice_id:
            selectedVoiceId,
        },
      },

      config: {
        fluent: true,

        stitch: true,
      },
    };

    console.log(
      "SENDING SPEECH TO D-ID:",
      {
        streamId,
        textLength:
          normalizedText.length,
        voiceId:
          selectedVoiceId,
        driverUrl:
          DEFAULT_DRIVER_URL,
      }
    );

    const response =
      await fetch(
        `${DID_API_URL}/talks/streams/${streamId}`,
        {
          method: "POST",

          headers:
            getHeaders(),

          body:
            JSON.stringify(
              requestBody
            ),
        }
      );

    const result =
      await parseResponse(
        response
      );

    console.log(
      "D-ID SPEECH CREATED:",
      {
        streamId,
        result,
      }
    );

    return result;
  };

/* =========================================================
   DELETE STREAM
========================================================= */

exports.deleteStream =
  async ({
    streamId,
    sessionId,
  }) => {
    if (
      !streamId ||
      !sessionId
    ) {
      return {
        success: true,
      };
    }

    const response =
      await fetch(
        `${DID_API_URL}/talks/streams/${streamId}`,
        {
          method: "DELETE",

          headers:
            getHeaders(),

          body:
            JSON.stringify({
              session_id:
                sessionId,
            }),
        }
      );

    if (
      response.status ===
        204 ||
      response.status ===
        200
    ) {
      console.log(
        "D-ID STREAM DELETED:",
        streamId
      );

      return {
        success: true,
      };
    }

    return parseResponse(
      response
    );
  };