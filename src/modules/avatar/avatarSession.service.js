const mongoose = require("mongoose");

const Twin = require(
  "../../models/Twin"
);

const AvatarSession = require(
  "../../models/AvatarSession"
);

const didAvatarService = require(
  "./didAvatar.service"
);

const createError = (
  message,
  statusCode = 500
) => {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
};

const validateObjectId = (
  value,
  fieldName = "ID"
) => {
  if (
    !value ||
    !mongoose.Types.ObjectId.isValid(
      value
    )
  ) {
    throw createError(
      `Invalid ${fieldName}.`,
      400
    );
  }
};

const findOwnedAvatarSession =
  async ({
    userId,
    avatarSessionId,
    allowedStatuses = null,
  }) => {
    validateObjectId(
      userId,
      "User ID"
    );

    validateObjectId(
      avatarSessionId,
      "avatar session ID"
    );

    const filter = {
      _id: avatarSessionId,
      userId,
    };

    if (
      Array.isArray(
        allowedStatuses
      ) &&
      allowedStatuses.length
    ) {
      filter.status = {
        $in: allowedStatuses,
      };
    }

    const session =
      await AvatarSession.findOne(
        filter
      );

    if (!session) {
      throw createError(
        "Avatar session not found.",
        404
      );
    }

    return session;
  };

/* =========================================================
   CREATE WEBRTC SESSION
========================================================= */

exports.createSession =
  async ({
    userId,
    twinId,
    realtimeSessionId = null,
  }) => {
    validateObjectId(
      userId,
      "User ID"
    );

    validateObjectId(
      twinId,
      "Twin ID"
    );

    if (realtimeSessionId) {
      validateObjectId(
        realtimeSessionId,
        "realtime session ID"
      );
    }

    const twin =
      await Twin.findOne({
        _id: twinId,
        userId,

        status: {
          $ne: "inactive",
        },
      });

    if (!twin) {
      throw createError(
        "AI Twin not found.",
        404
      );
    }

    const avatarUrl =
      String(
        twin.appearance?.avatarUrl ||
          twin.image ||
          ""
      ).trim();

    if (!avatarUrl) {
      throw createError(
        "AI Twin avatar image is missing.",
        400
      );
    }

    /*
     * A twin should have only one active
     * D-ID stream for the user.
     */
    const previousSessions =
      await AvatarSession.find({
        userId,
        twinId,

        status: {
          $in: [
            "connecting",
            "created",
            "active",
          ],
        },
      });

    for (
      const previousSession of
      previousSessions
    ) {
      try {
        if (
          previousSession
            .providerStreamId &&
          previousSession
            .providerSessionId
        ) {
          await didAvatarService
            .deleteStream({
              streamId:
                previousSession
                  .providerStreamId,

              sessionId:
                previousSession
                  .providerSessionId,
            });
        }
      } catch (error) {
        console.error(
          "OLD D-ID SESSION CLOSE ERROR:",
          error.message
        );
      }

      previousSession.status =
        "ended";

      previousSession.endedAt =
        new Date();

      await previousSession.save();
    }

    const avatarSession =
      await AvatarSession.create({
        userId,
        twinId,
        realtimeSessionId,
        provider: "did",
        avatarUrl,
        status: "connecting",
      });

    try {
      const providerResult =
        await didAvatarService
          .createStream({
            avatarUrl,
          });

      const streamId =
        providerResult?.id;

      const providerSessionId =
        providerResult?.session_id;

      const offer =
        providerResult?.offer;

      const iceServers =
        providerResult?.ice_servers ||
        [];

      if (
        !streamId ||
        !providerSessionId ||
        !offer?.type ||
        !offer?.sdp
      ) {
        throw createError(
          "D-ID did not return valid stream connection details.",
          502
        );
      }

      avatarSession.providerStreamId =
        streamId;

      avatarSession.providerSessionId =
        providerSessionId;

      avatarSession.offer =
        offer;

      avatarSession.iceServers =
        iceServers;

      avatarSession.status =
        "created";

      avatarSession.lastError =
        "";

      await avatarSession.save();

      return {
        avatarSessionId:
          avatarSession._id,

        streamId,

        sessionId:
          providerSessionId,

        offer,

        iceServers,

        avatarUrl,

        status:
          avatarSession.status,
      };
    } catch (error) {
      avatarSession.status =
        "failed";

      avatarSession.lastError =
        error.message ||
        "D-ID stream creation failed.";

      await avatarSession.save();

      throw error;
    }
  };

/* =========================================================
   SUBMIT SDP ANSWER
========================================================= */

exports.submitAnswer =
  async ({
    userId,
    avatarSessionId,
    answer,
  }) => {
    const session =
      await findOwnedAvatarSession({
        userId,
        avatarSessionId,

        allowedStatuses: [
          "connecting",
          "created",
        ],
      });

    if (
      !answer ||
      answer.type !== "answer" ||
      !String(
        answer.sdp || ""
      ).trim()
    ) {
      throw createError(
        "A valid WebRTC SDP answer is required.",
        400
      );
    }

    await didAvatarService
      .submitSdpAnswer({
        streamId:
          session.providerStreamId,

        sessionId:
          session.providerSessionId,

        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
      });

    session.status = "active";

    session.startedAt =
      session.startedAt ||
      new Date();

    session.lastError = "";

    await session.save();

    return session;
  };

/* =========================================================
   ADD ICE CANDIDATE
========================================================= */

exports.addIceCandidate =
  async ({
    userId,
    avatarSessionId,
    candidate,
    sdpMid,
    sdpMLineIndex,
  }) => {
    const session =
      await findOwnedAvatarSession({
        userId,
        avatarSessionId,

        allowedStatuses: [
          "connecting",
          "created",
          "active",
        ],
      });

    /*
     * The browser emits null when ICE
     * gathering has completed.
     */
    if (
      candidate === null ||
      candidate === undefined
    ) {
      return {
        success: true,
        completed: true,
      };
    }

    const cleanCandidate =
      String(candidate).trim();

    if (!cleanCandidate) {
      throw createError(
        "ICE candidate is required.",
        400
      );
    }

    await didAvatarService
      .addIceCandidate({
        streamId:
          session.providerStreamId,

        sessionId:
          session.providerSessionId,

        candidate:
          cleanCandidate,

        sdpMid:
          sdpMid ?? null,

        sdpMLineIndex:
          sdpMLineIndex ??
          null,
      });

    return {
      success: true,
      completed: false,
    };
  };

/* =========================================================
   MAKE AVATAR SPEAK
========================================================= */

exports.speak =
  async ({
    userId,
    avatarSessionId,
    text,
    language,
    audioUrl,
  }) => {
    const session =
      await findOwnedAvatarSession({
        userId,
        avatarSessionId,

        allowedStatuses: [
          "active",
        ],
      });

    const cleanText =
      String(text || "").trim();

    const cleanAudioUrl =
      String(
        audioUrl || ""
      ).trim();

    if (
      !cleanText &&
      !cleanAudioUrl
    ) {
      throw createError(
        "Text or audio URL is required.",
        400
      );
    }

    const twin =
      await Twin.findOne({
        _id: session.twinId,
        userId,

        status: {
          $ne: "inactive",
        },
      }).select(
        "primaryLanguage voice name"
      );

    if (!twin) {
      throw createError(
        "AI Twin not found.",
        404
      );
    }

    let providerResult;

    if (cleanAudioUrl) {
      providerResult =
        await didAvatarService
          .speakAudio({
            streamId:
              session
                .providerStreamId,

            sessionId:
              session
                .providerSessionId,

            audioUrl:
              cleanAudioUrl,
          });
    } else {
      providerResult =
        await didAvatarService
          .speakText({
            streamId:
              session
                .providerStreamId,

            sessionId:
              session
                .providerSessionId,

            text:
              cleanText,

            language:
              language ||
              twin.voice?.language ||
              twin.primaryLanguage ||
              "English",
          });
    }

    session.lastSpokenAt =
      new Date();

    session.lastError = "";

    await session.save();

    return {
      avatarSessionId:
        session._id,

      status:
        session.status,

      providerResult,
    };
  };

/* =========================================================
   GET SESSION
========================================================= */

exports.getSession =
  async ({
    userId,
    avatarSessionId,
  }) => {
    return findOwnedAvatarSession({
      userId,
      avatarSessionId,
    });
  };

/* =========================================================
   END SESSION
========================================================= */

exports.endSession =
  async ({
    userId,
    avatarSessionId,
  }) => {
    const session =
      await findOwnedAvatarSession({
        userId,
        avatarSessionId,
      });

    if (
      session.status === "ended"
    ) {
      return session;
    }

    try {
      if (
        session.providerStreamId &&
        session.providerSessionId
      ) {
        await didAvatarService
          .deleteStream({
            streamId:
              session
                .providerStreamId,

            sessionId:
              session
                .providerSessionId,
          });
      }
    } catch (error) {
      console.error(
        "D-ID STREAM CLOSE ERROR:",
        error.message
      );

      session.lastError =
        error.message;
    }

    session.status = "ended";
    session.endedAt = new Date();

    await session.save();

    return session;
  };
