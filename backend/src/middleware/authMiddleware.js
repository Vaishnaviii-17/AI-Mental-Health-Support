const { verifyToken } = require("../utils/jwt");
const userModel = require("../models/userModel");
const UnauthorizedError = require("../errors/UnauthorizedError");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // STEP 1: Check Authorization header
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.error("❌ Authorization header missing or invalid");

    return next(
      new UnauthorizedError("Access token is missing.")
    );
  }
  const token = authHeader.split(" ")[1];

  if (!token) {
    console.error("❌ Bearer token is empty");

    return next(
      new UnauthorizedError("Access token is missing.")
    );
  }

  let decoded;

  // STEP 2: Verify JWT
  try {
    decoded = verifyToken(token);

    console.log("✅ JWT verified successfully");
    console.log("JWT payload:", {
      id: decoded.id,
      username: decoded.username,
    });

    // Make sure the JWT contains the user ID
    if (!decoded.id) {
      console.error("❌ JWT does not contain user ID");

      return next(
        new UnauthorizedError("Invalid authentication token.")
      );
    }
  } catch (err) {
    console.error("❌ JWT verification failed");
    console.error("Error name:", err.name);
    console.error("Error message:", err.message);

    return next(
      new UnauthorizedError("Invalid or expired token.")
    );
  }

  // STEP 3: Find authenticated user
  try {
    const user = await userModel.findById(decoded.id);

    if (!user) {
      console.error("❌ User not found");
      console.error("JWT user ID:", decoded.id);

      return next(
        new UnauthorizedError("User not found.")
      );
    }

    // Only use fields that exist in your anonymous-user system.
    console.log("✅ User authenticated:", user.username);

    // Attach authenticated user to request
    req.user = user;

    // Continue to controller
    next();
  } catch (err) {
    console.error("❌ User lookup failed");
    console.error("Error name:", err.name);
    console.error("Error message:", err.message);

    return next(err);
  }
};

module.exports = authMiddleware;