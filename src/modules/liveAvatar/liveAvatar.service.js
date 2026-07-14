const LIVEAVATAR_API_URL = String(
  process.env.LIVEAVATAR_API_URL ||
    "https://api.liveavatar.com"
).replace(/\/+$/, "");

const getHeaders = () => {
  const apiKey = String(
    process.env.LIVEAVATAR_API_KEY || ""
  ).trim();

  if (!apiKey) {
    throw new Error(
      "LIVEAVATAR_API_KEY is missing."
    );
  }

  return {
    "X-API-KEY": apiKey,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
};

const parseResponse = async (response) => {
  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok || data?.code !== 1000) {
    const error = new Error(
      data?.message ||
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

  return data.data;
};

exports.createEmbed = async ({
  avatarId,
  contextId,
  sandbox = true,
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
    throw new Error(
      "LiveAvatar avatar ID is missing."
    );
  }

  if (!selectedContextId) {
    throw new Error(
      "LiveAvatar context ID is missing."
    );
  }

  const response = await fetch(
    `${LIVEAVATAR_API_URL}/v2/embeddings`,
    {
      method: "POST",
      headers: getHeaders(),

      body: JSON.stringify({
        avatar_id: selectedAvatarId,
        context_id: selectedContextId,
        is_sandbox: Boolean(sandbox),
      }),
    }
  );

  const result = await parseResponse(response);

  if (!result?.url) {
    throw new Error(
      "LiveAvatar did not return an embed URL."
    );
  }

  return {
    url: result.url,
    script: result.script || "",
  };
};