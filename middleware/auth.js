const jwt = require("jsonwebtoken");

const authMiddleware = (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("No token provided!"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.sub; // email stored as subject
    console.log(`✅ User authenticated: ${socket.userId}`);
    next();
  } catch (err) {
    return next(new Error("Invalid token!"));
  }
};

module.exports = authMiddleware;
