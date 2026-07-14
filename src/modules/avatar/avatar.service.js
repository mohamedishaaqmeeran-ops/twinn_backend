const mongoose = require("mongoose");

const Twin = require("../../models/Twin");
const AvatarSession = require("../../models/AvatarSession");

const didAvatarService = require("./didAvatar.service");

const validateObjectId = (
  value,
  fieldName = "ID"
) => {
  if (
    !mongoose.Types.ObjectId.isValid(
      value
    )
  ) {
    const error = new Error(
      `Invalid ${fieldName}.`
    );

    error.statusCode = 400;

    throw error;
  }
};

const findOwnedAvatarSession =
  async ({
    userId,
    avatarSessionId,
  }) => {
    validateObjectId(
      avatarSessionId,
      "avatar session ID"
    );

    const session =
      await AvatarSession.findOne({
        _id: avatarSessionId,
        userId,
      });

    if (!session) {
      const error = new Error(
        "Avatar session not found."
      );

      error.statusCode = 404;

      throw error;
    }

    return session;
  };

/* =========================================================
   CREATE STREAMING AVATAR SESSION
========================================================= */

exports.createSession =
  async ({
    userId,
    twinId,
    realtimeSessionId = null,
  }) => {
    validateObjectId(
      twinId,
      "Twin ID"
    );

    if (
      realtimeSessionId
    ) {
      validateObjectId(
        realtimeSessionId,
        "realtime session ID"
      );
    }

    const twin =
      await Twin.findOne({
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

    const avatarUrl =
      String(
        twin.appearance?.avatarUrl ||
          twin.image ||
          ""
      ).trim();

    if (!avatarUrl) {
      const error = new Error(
        "AI Twin avatar image is missing."
      );

      error.statusCode = 400;

      throw error;
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
        await didAvatarService.createStream({
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
        !offer
      ) {
        throw new Error(
          "D-ID did not return valid stream connection details."
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
      });

    if (
      !answer ||
      !answer.type ||
      !answer.sdp
    ) {
      const error = new Error(
        "A valid WebRTC SDP answer is required."
      );

      error.statusCode = 400;

      throw error;
    }

    await didAvatarService.submitSdpAnswer({
      streamId:
        session.providerStreamId,

      sessionId:
        session.providerSessionId,

      answer,
    });

    session.status =
      "active";

    session.startedAt =
      session.startedAt ||
      new Date();

    session.lastError =
      "";

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
      });

    await didAvatarService.addIceCandidate({
      streamId:
        session.providerStreamId,

      sessionId:
        session.providerSessionId,

      candidate,
      sdpMid,
      sdpMLineIndex,
    });

    return {
      success: true,
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
  }) => {
    const session =
      await findOwnedAvatarSession({
        userId,
        avatarSessionId,
      });

    if (
      session.status !==
      "active"
    ) {
      const error = new Error(
        "Avatar session is not active."
      );

      error.statusCode = 400;

      throw error;
    }

    const twin =
      await Twin.findOne({
        _id:
          session.twinId,
        userId,
      }).select(
        "primaryLanguage voice voiceName"
      );

    const selectedLanguage =
      String(
        language ||
          twin?.primaryLanguage ||
          twin?.voice?.language ||
          "English"
      ).trim();

    return didAvatarService.speakText({
      streamId:
        session.providerStreamId,

      sessionId:
        session.providerSessionId,

      text,

      language:
        selectedLanguage,
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

    try {
      await didAvatarService.deleteStream({
        streamId:
          session.providerStreamId,

        sessionId:
          session.providerSessionId,
      });
    } catch (error) {
      console.error(
        "D-ID STREAM CLOSE ERROR:",
        error.message
      );
    }

    session.status =
      "ended";

    session.endedAt =
      new Date();

    await session.save();

    return session;
  };