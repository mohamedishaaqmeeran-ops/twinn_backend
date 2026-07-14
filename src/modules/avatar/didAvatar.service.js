const DID_API_URL =
  String(
    process.env.DID_API_URL ||
      "https://api.d-id.com"
  ).replace(/\/+$/, "");

const getHeaders = () => {
  const apiKey = String(
    process.env.DID_API_KEY || ""
  ).trim();

  if (!apiKey) {
    throw new Error(
      "DID_API_KEY is missing."
    );
  }

  const authorizationValue =
    apiKey.startsWith("Basic ")
      ? apiKey
      : `Basic ${Buffer.from(apiKey).toString("base64")}`;

  return {
    Authorization: authorizationValue,
    "Content-Type": "application/json",
  };
};

const parseResponse = async (
  response
) => {
  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.description ||
        data?.message ||
        data?.kind ||
        `D-ID request failed with status ${response.status}.`
    );
  }

  return data;
};

exports.createStream = async ({
  avatarUrl,
}) => {
  const response = await fetch(
    `${DID_API_URL}/talks/streams`,
    {
      method: "POST",

      headers: getHeaders(),

      body: JSON.stringify({
        source_url: avatarUrl,
      }),
    }
  );

  return parseResponse(response);
};

exports.submitSdpAnswer = async ({
  streamId,
  sessionId,
  answer,
}) => {
  const response = await fetch(
    `${DID_API_URL}/talks/streams/${streamId}/sdp`,
    {
      method: "POST",

      headers: getHeaders(),

      body: JSON.stringify({
        answer,
        session_id: sessionId,
      }),
    }
  );

  return parseResponse(response);
};

exports.addIceCandidate =
  async ({
    streamId,
    sessionId,
    candidate,
    sdpMid,
    sdpMLineIndex,
  }) => {
    const response = await fetch(
      `${DID_API_URL}/talks/streams/${streamId}/ice`,
      {
        method: "POST",

        headers: getHeaders(),

      body: JSON.stringify({
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

    return parseResponse(response);
  };

exports.speakText = async ({
  streamId,
  sessionId,
  text,
}) => {
  const normalized =
    String(text || "").trim();

  if (!normalized) {
    throw new Error(
      "Avatar speech text is required."
    );
  }

  const response = await fetch(
    `${DID_API_URL}/talks/streams/${streamId}`,
    {
      method: "POST",

      headers: getHeaders(),

      body: JSON.stringify({
        session_id: sessionId,

        script: {
          type: "text",

          input: normalized,

          provider: {
            type: "microsoft",

            voice_id:
              "en-US-JennyNeural",
          },
        },
      }),
    }
  );

  return parseResponse(response);
};

exports.deleteStream = async ({
  streamId,
  sessionId,
}) => {
  const response = await fetch(
    `${DID_API_URL}/talks/streams/${streamId}`,
    {
      method: "DELETE",

      headers: getHeaders(),

      body: JSON.stringify({
        session_id: sessionId,
      }),
    }
  );

  if (
    response.status === 204
  ) {
    return {
      success: true,
    };
  }

  return parseResponse(response);
};