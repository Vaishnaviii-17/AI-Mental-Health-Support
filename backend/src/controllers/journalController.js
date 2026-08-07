const journalModel = require("../models/journalModel");
const moodModel = require("../models/moodModel");
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
 * Create a new journal entry
 */
const createJournal = asyncHandler(async (req, res) => {
  const { title, content } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json(response.error("Title is required"));
  }
  if (!content || !content.trim()) {
    return res.status(400).json(response.error("Journal content is required"));
  }

  // 1. Run AI Sentiment Analysis on the content
  const analysis = await geminiService.analyzeJournal(content);

  // 2. Save the journal entry to PostgreSQL
  const journal = await journalModel.createJournal(req.user.id, {
    title: title.trim(),
    content: content.trim(),
    mood: analysis.emoji,
    emotion: analysis.emotion,
    sentimentScore: analysis.sentimentScore,
    insight: analysis.insight,
  });

  // 3. Log a mood check-in based on this journal analysis so it's captured in the analytics
  await moodModel.createMood(req.user.id, {
    emoji: analysis.emoji,
    emotion: analysis.emotion,
    score: analysis.sentimentScore,
    insight: analysis.insight,
  });

  res.status(201).json(response.success("Journal entry saved successfully", journal));
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
