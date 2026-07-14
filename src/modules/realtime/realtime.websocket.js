const RealtimeSession = require("../../models/RealtimeSession");

const {
  initializeRealtimeSession,
} = require("./realtime.service");

const safeSend = (socket, payload) => {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
};

exports.handleRealtimeSocket = async (
  socket,
  request,
  connectionData
) => {
  try {
    const {
      sessionId,
      socketToken,
    } = connectionData;

    if (!sessionId || !socketToken) {
      throw new Error(
        "Session ID and socket token are required."
      );
    }

    const result = await initializeRealtimeSession({
      sessionId,
      socketToken,
      websocket: socket,
    });

    await RealtimeSession.updateOne(
      {
        _id: sessionId,
        socketToken,
      },
      {
        $set: {
          status: "active",
        },
      }
    );

    safeSend(socket, {
      type: "session.ready",
      sessionId,
      twinId: result.twin._id,
      productScope:
        result.session.productId
          ? "selected-product"
          : "user-catalogue",
    });

    socket.on("close", async () => {
      await RealtimeSession.updateOne(
        {
          _id: sessionId,
          socketToken,
        },
        {
          $set: {
            status: "closed",
          },
        }
      ).catch(console.error);
    });
  } catch (error) {
    console.error("REALTIME SOCKET ERROR:", error);

    safeSend(socket, {
      type: "session.error",
      message:
        error.message ||
        "Unable to initialize realtime session.",
    });

    socket.close(1008, "Invalid realtime session");
  }
};