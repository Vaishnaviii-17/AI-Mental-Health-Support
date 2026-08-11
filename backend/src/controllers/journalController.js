const journalModel = require("../models/journalModel");
const inferenceService = require("../services/inferenceService");
const {
  emotionToEmoji,
  sentimentToScore,
  buildJournalSummary,
  resolveEmotion,
  resolveRisk,
} = require("../utils/mlMapping");
const geminiService = require("../services/geminiService");
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
 * Journal analysis comes from the trained GoEmotions model (via the
 * Python inference server) -- the sole emotion-analysis model.
 * Python is also the sole authority for risk screening
 * (calculate_risk_assessment() in predictor.py); this controller
 * only reads analysis.risk and persists it, it never recalculates
 * risk in Node. Risk screening is a heuristic indicator, not a
 * clinical assessment.
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

  // 1. Run the trained GoEmotions model (emotion + sentiment + risk)
  //    via the Python inference server. A single call -- Python
  //    already returns emotion, sentiment, AND risk together.
  let analysis;

  try {
    analysis = await inferenceService.analyzeText(trimmedContent);
  } catch (err) {
    console.error("Journal ML analysis failed:", err.message);

    // Do not save a journal entry we couldn't analyze, and never leak
    // the underlying Python error/stack trace to the client.
    return res
      .status(503)
      .json(
        response.error(
          "Emotion analysis service is temporarily unavailable."
        )
      );
  }

  // 2. Map the ML analysis onto the EXISTING journal schema
  //    (title, content, mood, emotion, secondary_emotions,
  //    sentiment_score, risk_analysis, insight). Python already
  //    resolved emotion + risk; resolveEmotion()/resolveRisk() just
  //    read those decisions -- they do NOT re-evaluate them.
  const resolvedEmotion = resolveEmotion(analysis);
  const resolvedRisk = resolveRisk(analysis);

  const finalEmotion = resolvedEmotion.emotion || null;

  // Full risk object as returned by Python, persisted as-is into
  // the risk_analysis JSONB column. Node does not add to, remove
  // from, or recompute any part of it.
  const riskAnalysis = analysis?.risk || null;

  console.log("🧠 Emotion resolution:", {
    emotion: finalEmotion,
    probability: resolvedEmotion.probability,
    source: resolvedEmotion.source,
    secondaryEmotions: resolvedEmotion.secondaryEmotions,
  });

  console.log("🛟 Risk screening resolution:", {
    riskLevel: resolvedRisk.riskLevel,
    riskScore: resolvedRisk.riskScore,
    detectedCategories: resolvedRisk.detectedCategories.map((c) => c.key),
    protectiveSignals: resolvedRisk.protectiveSignals,
  });

  const journal = await journalModel.createJournal(req.user.id, {
    title: title.trim(),
    content: trimmedContent,
    mood: emotionToEmoji(finalEmotion),
    emotion: finalEmotion,
    secondaryEmotions: resolvedEmotion.secondaryEmotions,
    sentimentScore: sentimentToScore(analysis.sentiment?.scores),
    riskAnalysis,
    insight: buildJournalSummary(analysis),
  });

  // NOTE: We intentionally do NOT auto-create a mood check-in record
  // here. A journal entry is not the same thing as an explicit mood
  // check-in -- see moodAnalysisService.js.

  res
    .status(201)
    .json(response.success("Journal entry saved successfully", journal));
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
