const pool = require("../config/database");

const getUserIdByEmail = async (email) => {
  const result = await pool.query("SELECT id FROM users WHERE email = $1", [
    email,
  ]);
  return result.rows[0]?.id;
};

const messageHandler = (io, socket) => {
  console.log(`🔌 User connected: ${socket.userId}`);

  // Setup user's personal room
  const setupUserRoom = async () => {
    const userId = await getUserIdByEmail(socket.userId);
    socket.userDbId = userId;
    socket.join(`user_${userId}`);
    console.log(`👤 User ${userId} joined room: user_${userId}`);
  };

  setupUserRoom();

  // Send message
  socket.on("send_message", async (data) => {
    try {
      const { receiverId, matchId, content } = data;

      // Save message to database
      const result = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, match_id, content)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
        [socket.userDbId, receiverId, matchId, content],
      );

      const message = result.rows[0];
      console.log(`💬 Message saved: ${content}`);

      // Send to receiver in real-time!
      io.to(`user_${receiverId}`).emit("receive_message", {
        id: message.id,
        senderId: socket.userDbId,
        receiverId: receiverId,
        matchId: matchId,
        content: content,
        createdAt: message.created_at,
      });

      // Confirm to sender
      socket.emit("message_sent", {
        success: true,
        message: message,
      });
    } catch (err) {
      console.error("Error sending message:", err);
      socket.emit("error", { message: "Failed to send message!" });
    }
  });

  // Get chat history
  socket.on("get_messages", async (data) => {
    try {
      const { matchId } = data;

      const result = await pool.query(
        `SELECT * FROM messages 
                 WHERE match_id = $1 
                 ORDER BY created_at ASC`,
        [matchId],
      );

      socket.emit("chat_history", result.rows);
      console.log(`📜 Chat history sent for match: ${matchId}`);
    } catch (err) {
      console.error("Error getting messages:", err);
      socket.emit("error", { message: "Failed to get messages!" });
    }
  });

  // Mark messages as read
  socket.on("mark_as_read", async (data) => {
    try {
      const { matchId } = data;

      await pool.query(
        `UPDATE messages 
                 SET is_read = TRUE 
                 WHERE match_id = $1 AND receiver_id = $2`,
        [matchId, socket.userDbId],
      );

      socket.emit("messages_marked_read", { success: true });
      console.log(`✅ Messages marked as read for match: ${matchId}`);
    } catch (err) {
      console.error("Error marking messages as read:", err);
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`🔌 User disconnected: ${socket.userId}`);
  });
};

module.exports = messageHandler;
