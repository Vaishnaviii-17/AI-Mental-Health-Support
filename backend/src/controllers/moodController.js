const moodModel = require("../models/moodModel");
const inferenceService = require("../services/inferenceService");
const moodAnalysisService = require("../services/moodAnalysisService");
const { sentimentToScore } = require("../utils/mlMapping");
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
  const { emoji, emotion, score, confidence, text } = req.body;

  let finalEmotion = emotion || null;
  let finalScore = score !== undefined && score !== null ? Number(score) : null;
  let mlAnalysis = null;

  if (typeof text === "string" && text.trim()) {
    try {
      mlAnalysis = await inferenceService.analyzeText(text);
    } catch (err) {
      console.error("Mood text analysis failed:", err.message);
      return res
        .status(503)
        .json(response.error("Emotion analysis service is temporarily unavailable."));
    }

    if (!finalEmotion) {
      finalEmotion = mlAnalysis.emotion?.emotion || null;
    }
    if (finalScore === null) {
      finalScore = sentimentToScore(mlAnalysis.sentiment?.scores);
    }
  }

  if (!finalEmotion) {
    return res
      .status(400)
      .json(response.error("emotion is required (provide it explicitly, or provide text to analyze)"));
  }
  if (finalScore === null || Number.isNaN(finalScore)) {
    return res
      .status(400)
      .json(response.error("score is required (provide it explicitly, or provide text to analyze)"));
  }

  const mood = await moodModel.createMood(req.user.id, {
    emoji: emoji || null,
    emotion: finalEmotion,
    score: finalScore,
    confidence,
    insight: null,
  });

  res.status(201).json(
    response.success("Mood entry saved successfully", {
      mood,
      analysis: mlAnalysis, // null when no `text` was supplied
    })
  );
});

/**
 * Get today's combined mood analysis: explicit mood check-ins today +
 * ML analysis of today's journal entries, aggregated deterministically.
 * See moodAnalysisService.js for the aggregation logic (the single
 * source of truth for this combination).
 */
const getTodayAnalysis = asyncHandler(async (req, res) => {
  const analysis = await moodAnalysisService.getTodayAnalysis(req.user.id);
  res
    .status(200)
    .json(response.success("Today's mood analysis retrieved successfully", analysis));
});

module.exports = {
  getStats,
  getHistory,
  getActivityCalendar,
  createMood,
  getTodayAnalysis,
};