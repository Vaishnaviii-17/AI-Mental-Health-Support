const userModel = require("../models/userModel");
const { hashPassword, comparePassword } = require("../utils/password");
const response = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Get profile details of the current user
 */
const getProfile = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  if (!user) {
    return res.status(404).json(response.error("User not found"));
  }

  // Format response matching profile view requirements
  res.status(200).json(response.success("Profile fetched successfully", {
    id: user.id,
    username: user.username,
    fullName: user.full_name || "",
    email: user.email || "",
    memberSince: user.created_at,
  }));
});

/**
 * Update current user profile (name and email)
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, email } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json(response.error("Name cannot be empty"));
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json(response.error("A valid email address is required"));
  }

  // Check if email is already taken by another user
  if (email !== req.user.email) {
    const pool = require("../config/db");
    const checkEmail = await pool.query("SELECT id FROM users WHERE email = $1 AND id != $2", [email, req.user.id]);
    if (checkEmail.rows.length > 0) {
      return res.status(409).json(response.error("Email is already in use by another account"));
    }
  }

  const updatedUser = await userModel.updateProfile(req.user.id, {
    username: req.user.username,
    email: email.trim(),
    full_name: name.trim(),
  });

  res.status(200).json(response.success("Profile updated successfully", {
    id: updatedUser.id,
    username: updatedUser.username,
    fullName: updatedUser.full_name,
    email: updatedUser.email,
    memberSince: updatedUser.created_at,
  }));
});

/**
 * Change current user password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json(response.error("Both current and new passwords are required"));
  }

  if (newPassword.length < 8) {
    return res.status(400).json(response.error("New password must be at least 8 characters long"));
  }

  // Retrieve user with password
  const user = await userModel.findByUsername(req.user.username);
  if (!user) {
    return res.status(404).json(response.error("User not found"));
  }

  // Compare passwords
  const isMatch = await comparePassword(currentPassword, user.password);
  if (!isMatch) {
    return res.status(400).json(response.error("Current password incorrect"));
  }

  // Hash new password and save
  const hashed = await hashPassword(newPassword);
  await userModel.updatePassword(req.user.id, hashed);

  res.status(200).json(response.success("Password changed successfully"));
});

/**
 * Delete account and all associated user data cascadingly
 */
const deleteAccount = asyncHandler(async (req, res) => {
  await userModel.deleteUser(req.user.id);
  res.status(200).json(response.success("Account deleted successfully"));
});

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
};
