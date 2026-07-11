const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const jwt = require("jsonwebtoken");

// JWT verification middleware for REST endpoints
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No token provided!",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userEmail = decoded.sub;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid token!",
    });
  }
};

// Get user ID from email helper
const getUserIdByEmail = async (email) => {
  const result = await pool.query("SELECT id FROM users WHERE email = $1", [
    email,
  ]);
  return result.rows[0]?.id;
};

// GET /messages/:matchId - get chat history
router.get("/:matchId", verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;

    const result = await pool.query(
      `SELECT * FROM messages 
             WHERE match_id = $1 
             ORDER BY created_at ASC`,
      [matchId],
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error("Error getting messages:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get messages!",
    });
  }
});

// GET /messages/:matchId/unread - get unread count
router.get("/:matchId/unread", verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = await getUserIdByEmail(req.userEmail);

    const result = await pool.query(
      `SELECT COUNT(*) as unread_count 
             FROM messages 
             WHERE match_id = $1 
             AND receiver_id = $2 
             AND is_read = FALSE`,
      [matchId, userId],
    );

    res.json({
      success: true,
      unreadCount: parseInt(result.rows[0].unread_count),
    });
  } catch (err) {
    console.error("Error getting unread count:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get unread count!",
    });
  }
});

// POST /messages/notify - called by Spring Boot to push instant notifications
router.post("/notify", async (req, res) => {
  try {
    const { recipientId, senderId, type, message } = req.body;

    // Get the io instance
    const io = req.app.get("io");

    // Push to recipient's room instantly!
    io.to(`user_${recipientId}`).emit("notification", {
      type: type,
      message: message,
      senderId: senderId,
      timestamp: new Date(),
    });

    console.log(`🔔 Notification pushed to user_${recipientId}: ${message}`);

    res.json({
      success: true,
      message: "Notification pushed!",
    });
  } catch (err) {
    console.error("Error pushing notification:", err);
    res.status(500).json({
      success: false,
      message: "Failed to push notification!",
    });
  }
});

module.exports = router;
