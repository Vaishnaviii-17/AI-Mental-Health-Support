const userModel = require("../models/userModel");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");

const ConflictError = require("../errors/ConflictError");
const UnauthorizedError = require("../errors/UnauthorizedError");

async function signup({ username, password }) {
  // Check if username already exists
  const existingUser = await userModel.findByUsername(username);

  if (existingUser) {
    throw new ConflictError("Username already exists.");
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const user = await userModel.createUser({
    username,
    password: hashedPassword,
  });

  // Generate JWT
  const token = generateToken({
    id: user.id,
    username: user.username,
  });

  return {
    user,
    token,
  };
}

async function login({ username, password }) {
  // Find user
  const user = await userModel.findByUsername(username);

  if (!user) {
    throw new UnauthorizedError("Invalid username or password.");
  }

  // Compare password
  const isPasswordCorrect = await comparePassword(
    password,
    user.password
  );

  if (!isPasswordCorrect) {
    throw new UnauthorizedError("Invalid username or password.");
  }

  // Generate JWT
  const token = generateToken({
    id: user.id,
    username: user.username,
  });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
    },
  };
}

module.exports = {
  signup,
  login,
};