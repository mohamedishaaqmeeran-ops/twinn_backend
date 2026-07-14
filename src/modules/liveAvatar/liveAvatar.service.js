const LIVEAVATAR_API_URL = String(
  process.env.LIVEAVATAR_API_URL ||
    "https://api.liveavatar.com"
).replace(/\/+$/, "");

/* =========================================================
   HELPERS
========================================================= */

const getApiKey = () => {
  const apiKey = String(
    process.env.LIVEAVATAR_API_KEY || ""
  ).trim();

  if (!apiKey) {
    const error = new Error(
      "LIVEAVATAR_API_KEY is missing."
    );

    error.statusCode = 500;

    throw error;
  }

  return apiKey;
};

const getHeaders = () => {
  return {
    "X-API-KEY": getApiKey(),
    Accept: "application/json",
    "Content-Type": "application/json",
  };
};

const parseResponse = async (response) => {
  const contentType =
    response.headers.get("content-type") || "";

  const data = contentType.includes(
    "application/json"
  )
    ? await response.json().catch(() => ({}))
    : {
        message: await response
          .text()
          .catch(() => ""),
      };

  /*
   * LiveAvatar normally returns:
   *
   * {
   *   code: 1000,
   *   data: {...},
   *   message: "..."
   * }
   */
  if (
    !response.ok ||
    (data?.code !== undefined &&
      Number(data.code) !== 1000)
  ) {
    console.error("LIVEAVATAR API ERROR:", {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      data,
    });

    const error = new Error(
      data?.message ||
        data?.detail ||
        data?.error ||
        `LiveAvatar request failed (${response.status}).`
    );

    error.statusCode =
      response.status >= 400 &&
      response.status < 500
        ? response.status
        : 502;

    error.details = data;

    throw error;
  }

  return data?.data || data;
};

const getSandboxMode = () => {
  return (
    String(
      process.env.LIVEAVATAR_SANDBOX ||
        "true"
    ).toLowerCase() === "true"
  );
};

/* =========================================================
   CREATE EMBED
========================================================= */

exports.createEmbed = async ({
  avatarId,
  contextId,
  sandbox,
}) => {
  const selectedAvatarId = String(
    avatarId ||
      process.env.LIVEAVATAR_AVATAR_ID ||
      ""
  ).trim();

  const selectedContextId = String(
    contextId ||
      process.env.LIVEAVATAR_CONTEXT_ID ||
      ""
  ).trim();

  if (!selectedAvatarId) {
    const error = new Error(
      "LiveAvatar avatar ID is missing."
    );

    error.statusCode = 400;

    throw error;
  }

  if (!selectedContextId) {
    const error = new Error(
      "LiveAvatar context ID is missing."
    );

    error.statusCode = 400;

    throw error;
  }

  const requestBody = {
    avatar_id: selectedAvatarId,
    context_id: selectedContextId,

    is_sandbox:
      typeof sandbox === "boolean"
        ? sandbox
        : getSandboxMode(),
  };

  console.log("CREATING LIVEAVATAR EMBED:", {
    avatarId: selectedAvatarId,
    contextId: selectedContextId,
    sandbox: requestBody.is_sandbox,
  });

  const response = await fetch(
    `${LIVEAVATAR_API_URL}/v2/embeddings`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(requestBody),
    }
  );

  const result = await parseResponse(response);

  if (!result?.url) {
    const error = new Error(
      "LiveAvatar did not return an embed URL."
    );

    error.statusCode = 502;

    throw error;
  }

  return {
    url: result.url,
    script: result.script || "",
    avatarId: selectedAvatarId,
    contextId: selectedContextId,
    sandbox: requestBody.is_sandbox,
  };
};

/* =========================================================
   OPTIONAL API HEALTH TEST
========================================================= */

exports.testConfiguration = async () => {
  return exports.createEmbed({
    sandbox: true,
  });
};