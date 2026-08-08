const moodModel = require("../models/moodModel");
const response = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Get today's manual mood for the logged-in user.
 *
 * Used by the dashboard to determine whether
 * the daily mood popup should be displayed.
 */
const getTodayMood = asyncHandler(async (req, res) => {
  const mood = await moodModel.getTodayMood(req.user.id);

  res.status(200).json(
    response.success(
      "Today's mood retrieved successfully",
      mood
    )
  );
});

/**
 * Create today's manual mood check-in.
 *
 * Only one manual mood is allowed per user per day.
 */
const createDailyMood = asyncHandler(async (req, res) => {
  const {
    emoji,
    emotion,
    score,
    note,
  } = req.body;

  // -----------------------------
  // Basic validation
  // -----------------------------

  if (!emoji) {
    return res.status(400).json(
      response.error("Mood emoji is required")
    );
  }

  if (!emotion) {
    return res.status(400).json(
      response.error("Mood emotion is required")
    );
  }

  if (score === undefined || score === null) {
    return res.status(400).json(
      response.error("Mood score is required")
    );
  }

  // Score must be between 1 and 5.
  const numericScore = Number(score);

  if (
    !Number.isInteger(numericScore) ||
    numericScore < 1 ||
    numericScore > 5
  ) {
    return res.status(400).json(
      response.error("Mood score must be between 1 and 5")
    );
  }

  // Note is optional but limited to 200 characters.
  if (note && note.length > 200) {
    return res.status(400).json(
      response.error(
        "Mood note cannot exceed 200 characters"
      )
    );
  }

  // -----------------------------
  // Check whether today's mood
  // already exists.
  // -----------------------------

  const existingMood = await moodModel.getTodayMood(
    req.user.id
  );

  if (existingMood) {
    return res.status(409).json(
      response.error(
        "You have already recorded your mood today"
      )
    );
  }

  // -----------------------------
  // Create today's mood
  // -----------------------------

  const mood = await moodModel.createDailyMood(
    req.user.id,
    {
      emoji,
      emotion,
      score: numericScore,
      note: note?.trim() || null,
    }
  );

  res.status(201).json(
    response.success(
      "Today's mood saved successfully",
      mood
    )
  );
});

/**
 * Update today's manual mood.
 *
 * This updates the existing row rather than
 * creating another mood record.
 */
const updateTodayMood = asyncHandler(async (req, res) => {
  const {
    emoji,
    emotion,
    score,
    note,
  } = req.body;

  // -----------------------------
  // Basic validation
  // -----------------------------

  if (!emoji) {
    return res.status(400).json(
      response.error("Mood emoji is required")
    );
  }

  if (!emotion) {
    return res.status(400).json(
      response.error("Mood emotion is required")
    );
  }

  if (score === undefined || score === null) {
    return res.status(400).json(
      response.error("Mood score is required")
    );
  }

  const numericScore = Number(score);

  if (
    !Number.isInteger(numericScore) ||
    numericScore < 1 ||
    numericScore > 5
  ) {
    return res.status(400).json(
      response.error("Mood score must be between 1 and 5")
    );
  }

  if (note && note.length > 200) {
    return res.status(400).json(
      response.error(
        "Mood note cannot exceed 200 characters"
      )
    );
  }

  // -----------------------------
  // Update today's mood
  // -----------------------------

  const mood = await moodModel.updateTodayMood(
    req.user.id,
    {
      emoji,
      emotion,
      score: numericScore,
      note: note?.trim() || null,
    }
  );

  // No manual mood exists today.
  if (!mood) {
    return res.status(404).json(
      response.error(
        "No mood check-in found for today"
      )
    );
  }

  res.status(200).json(
    response.success(
      "Today's mood updated successfully",
      mood
    )
  );
});

/**
 * Get aggregate mood statistics.
 */
const getStats = asyncHandler(async (req, res) => {
  const stats = await moodModel.getMoodStats(req.user.id);

  res.status(200).json(
    response.success(
      "Mood statistics retrieved successfully",
      stats
    )
  );
});

/**
 * Get mood history.
 */
const getHistory = asyncHandler(async (req, res) => {
  const history = await moodModel.getMoodHistory(req.user.id);

  res.status(200).json(
    response.success(
      "Mood history retrieved successfully",
      history
    )
  );
});

/**
 * Get daily activity counts for the activity calendar.
 */
const getActivityCalendar = asyncHandler(async (req, res) => {
  const activity =
    await moodModel.getActivityCalendar(req.user.id);

  res.status(200).json(
    response.success(
      "Activity calendar retrieved successfully",
      activity
    )
  );
});

module.exports = {
  getTodayMood,
  createDailyMood,
  updateTodayMood,
  getStats,
  getHistory,
  getActivityCalendar,
};