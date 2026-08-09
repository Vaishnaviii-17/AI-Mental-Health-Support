const journalModel = require("../models/journalModel");
const inferenceService = require("../services/inferenceService");
const { emotionToEmoji, sentimentToScore, buildJournalSummary, resolveEmotion } = require("../utils/mlMapping");
const response = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Get all journal entries for the current user
 */
const getJournals = asyncHandler(async (req, res) => {
  const journals = await journalModel.getJournals(req.user.id);
  res.status(200).json(response.success("Journals retrieved successfully", journals));
});

/**
 * Get a specific journal entry by ID
 */
const getJournalById = asyncHandler(async (req, res) => {
  const journal = await journalModel.getJournalById(req.params.id, req.user.id);
  if (!journal) {
    return res.status(404).json(response.error("Journal entry not found"));
  }
  res.status(200).json(response.success("Journal retrieved successfully", journal));
});

/**
 * Create a new journal entry.
 *
 * Journal analysis now comes from the trained ML models (via the Python
 * inference server) instead of Gemini. Gemini is left untouched for any
 * other feature that may still use it (see geminiService.js).
 */
const createJournal = asyncHandler(async (req, res) => {
  const { title, content } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json(response.error("Title is required"));
  }
  if (!content || !content.trim()) {
    return res.status(400).json(response.error("Journal content is required"));
  }

  const trimmedContent = content.trim();

  // 1. Run the trained ML models (6-class emotion + GoEmotions
  //    sentiment/risk) via the Python inference server. This replaces
  //    the previous geminiService.analyzeJournal(content) call.
  let analysis;
  try {
    analysis = await inferenceService.analyzeText(trimmedContent);
  } catch (err) {
    console.error("Journal ML analysis failed:", err.message);
    // Do not save a journal entry we couldn't analyze, and never leak
    // the underlying Python error/stack trace to the client.
    return res
      .status(503)
      .json(response.error("Emotion analysis service is temporarily unavailable."));
  }

  // 2. Map the ML analysis onto the EXISTING journal schema
  //    (title, content, mood, emotion, sentiment_score, insight).
  //    Python (predictor.py) already made the final primary-vs-fallback
  //    decision; resolveEmotion() just reads that decision -- it does
  //    NOT re-evaluate ambiguity. See utils/mlMapping.js for details.
  const resolvedEmotion = resolveEmotion(analysis);

  const finalEmotion = resolvedEmotion.emotion || null;

  console.log("🧠 Emotion resolution:", {
    primaryEmotion: resolvedEmotion.primaryEmotion,
    primaryConfidence: resolvedEmotion.primaryConfidence,
    finalEmotion,
    source: resolvedEmotion.source,
    fallbackReason: resolvedEmotion.fallbackReason,
    fallbackWasAmbiguous: resolvedEmotion.fallbackWasAmbiguous,
  });

  const journal = await journalModel.createJournal(req.user.id, {
  title: title.trim(),
  content: trimmedContent,
  mood: emotionToEmoji(finalEmotion),
  emotion: finalEmotion,
  sentimentScore: sentimentToScore(
    analysis.sentiment?.scores
  ),
  insight: buildJournalSummary(analysis),

  // Preserve the Python risk assessment in the journal record.
  riskLevel: analysis.risk?.risk_level || "low",
  riskScore:
    typeof analysis.risk?.risk_score === "number"
      ? analysis.risk.risk_score
      : 0,
});

  // NOTE: We intentionally do NOT auto-create a mood check-in record
  // here anymore. A journal entry is not the same thing as an explicit
  // mood check-in, and auto-creating one on every journal entry was
  // polluting mood analytics (average score, emotion distribution,
  // etc). Explicit mood check-ins now only come from POST /api/moods.
  // GET /api/moods/today-analysis combines both signals without
  // conflating them -- see moodAnalysisService.js.

  // 3. Return the saved journal AND the full ML analysis (including
  //    goemotions detail and the full risk breakdown) so the frontend
  //    has everything it needs without calling the Python server
  //    directly.
  res.status(201).json(
    response.success("Journal entry saved successfully", {
      journal,
      analysis,
    })
  );
});

/**
 * Delete a journal entry by ID
 */
const deleteJournal = asyncHandler(async (req, res) => {
  const journal = await journalModel.deleteJournal(req.params.id, req.user.id);
  if (!journal) {
    return res.status(404).json(response.error("Journal entry not found or unauthorized"));
  }
  res.status(200).json(response.success("Journal entry deleted successfully"));
});

module.exports = {
  getJournals,
  getJournalById,
  createJournal,
  deleteJournal,
};