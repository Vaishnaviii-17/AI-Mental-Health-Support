const moodModel = require("../models/moodModel");
const response = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Get aggregate mood statistics for the logged-in user
 */
const getStats = asyncHandler(async (req, res) => {
  const stats = await moodModel.getMoodStats(req.user.id);
  res.status(200).json(response.success("Mood statistics retrieved successfully", stats));
});

/**
 * Get the log list of mood check-ins for the logged-in user
 */
const getHistory = asyncHandler(async (req, res) => {
  const history = await moodModel.getMoodHistory(req.user.id);
  res.status(200).json(response.success("Mood history retrieved successfully", history));
});

/**
 * Get daily activity counts for the activity calendar heatmap
 */
const getActivityCalendar = asyncHandler(async (req, res) => {
  const activity = await moodModel.getActivityCalendar(req.user.id);
  res.status(200).json(response.success("Activity calendar retrieved successfully", activity));
});

module.exports = {
  getStats,
  getHistory,
  getActivityCalendar,
};
