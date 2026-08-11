const moodModel = require("../models/moodModel");
const inferenceService = require("../services/inferenceService");
const moodAnalysisService = require("../services/moodAnalysisService");
const { sentimentToScore } = require("../utils/mlMapping");
const response = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Create an explicit mood check-in.
 *
 * Body:
 *   {
 *     emoji?: string,
 *     emotion?: string,
 *     score?: number,
 *     confidence?: number,
 *     text?: string
 *   }
 *
 * Behavior:
 *   - If the user explicitly supplies emoji/emotion/score, those are
 *     stored exactly as given -- a user-reported signal, never
 *     overwritten by a model prediction.
 *   - If `text` is supplied, it is optionally analyzed by the trained ML
 *     inference service ONLY to fill in whichever of emotion/score the
 *     user did not explicitly provide. The full ML analysis is returned
 *     in the response either way, for transparency.
 *   - `emotion` and `score` are still required in the end (either
 *     explicit or derivable from text), since the existing moods schema
 *     expects both.
 */
const createMood = asyncHandler(async (req, res) => {
  const {
    emoji,
    emotion,
    score,
    confidence,
    text,
  } = req.body;

  let finalEmotion = emotion || null;

  let finalScore =
    score !== undefined && score !== null
      ? Number(score)
      : null;

  let mlAnalysis = null;

  if (typeof text === "string" && text.trim()) {
    try {
      mlAnalysis = await inferenceService.analyzeText(text);
    } catch (err) {
      console.error("Mood text analysis failed:", err.message);

      return res
        .status(503)
        .json(
          response.error(
            "Emotion analysis service is temporarily unavailable."
          )
        );
    }

    if (!finalEmotion) {
      finalEmotion = mlAnalysis.emotion?.emotion || null;
    }

    if (finalScore === null) {
      finalScore = sentimentToScore(
        mlAnalysis.sentiment?.scores
      );
    }
  }

  if (!finalEmotion) {
    return res
      .status(400)
      .json(
        response.error(
          "emotion is required (provide it explicitly, or provide text to analyze)"
        )
      );
  }

  if (
    finalScore === null ||
    Number.isNaN(finalScore)
  ) {
    return res
      .status(400)
      .json(
        response.error(
          "score is required (provide it explicitly, or provide text to analyze)"
        )
      );
  }

  const mood = await moodModel.createMood(
    req.user.id,
    {
      emoji: emoji || null,
      emotion: finalEmotion,
      score: finalScore,
      confidence,
      insight: null,
    }
  );

  res.status(201).json(
    response.success(
      "Mood entry saved successfully",
      {
        mood,
        analysis: mlAnalysis,
      }
    )
  );
});

/**
 * Get today's combined mood analysis:
 * explicit mood check-ins today + ML analysis of today's journal entries.
 *
 * The aggregation logic is handled by moodAnalysisService.js,
 * which is the single source of truth for this combination.
 */
const getTodayAnalysis = asyncHandler(async (req, res) => {
  const analysis =
    await moodAnalysisService.getTodayAnalysis(
      req.user.id
    );

  res
    .status(200)
    .json(
      response.success(
        "Today's mood analysis retrieved successfully",
        analysis
      )
    );
});

/**
 * Get today's manual mood for the logged-in user.
 *
 * Used by the dashboard to determine whether
 * the daily mood popup should be displayed.
 */
const getTodayMood = asyncHandler(async (req, res) => {
  const mood = await moodModel.getTodayMood(
    req.user.id
  );

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
      response.error(
        "Mood score must be between 1 and 5"
      )
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

  const existingMood =
    await moodModel.getTodayMood(
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

  const mood =
    await moodModel.createDailyMood(
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
      response.error(
        "Mood score must be between 1 and 5"
      )
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

  const mood =
    await moodModel.updateTodayMood(
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
  const stats = await moodModel.getMoodStats(
    req.user.id
  );

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
  const history = await moodModel.getMoodHistory(
    req.user.id
  );

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
    await moodModel.getActivityCalendar(
      req.user.id
    );

  res.status(200).json(
    response.success(
      "Activity calendar retrieved successfully",
      activity
    )
  );
});

module.exports = {
  createMood,
  getTodayAnalysis,
  getTodayMood,
  createDailyMood,
  updateTodayMood,
  getStats,
  getHistory,
  getActivityCalendar,
};