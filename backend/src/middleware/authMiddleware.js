const { verifyToken } = require("../utils/jwt");
const userModel = require("../models/userModel");
const UnauthorizedError = require("../errors/UnauthorizedError");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Access token is missing."));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);

    const user = await userModel.findById(decoded.id);

    if (!user) {
      return next(new UnauthorizedError("User not found."));
    }

    req.user = user;

    next();
  } catch (err) {
    next(new UnauthorizedError("Invalid or expired token."));
  }
};

module.exports = authMiddleware;