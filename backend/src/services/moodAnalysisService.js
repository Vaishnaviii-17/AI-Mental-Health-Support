/**
 * moodAnalysisService.js
 *
 * Combines THREE sources of information into one daily analysis:
 *   1. Explicit mood check-ins (moods table)      -- user-reported signal
 *   2. Today's journal entries, analyzed by the trained ML models
 *   3. (The explicit "how are you feeling today" popup is out of scope
 *      here; it is expected to be stored as a mood check-in via
 *      POST /api/moods and therefore already covered by source 1.)
 *
 * IMPORTANT: this aggregation is application-level logic, NOT another
 * trained classifier. It never claims to be a model prediction, and the
 * risk output remains an engineering screening indicator (see risk
 * aggregation rules below) -- never a diagnosis or clinical probability.
 *
 * This is the single source of truth for "today's combined analysis";
 * do not duplicate this logic elsewhere.
 */
const moodModel = require("../models/moodModel");
const journalModel = require("../models/journalModel");
const inferenceService = require("./inferenceService");

const RISK_PRIORITY = {
  low: 0,
  elevated: 1,
  high: 2,
  critical: 3,
};

/**
 * Run the trained ML models against today's journal entries.
 *
 * NOTE ON CACHING: journal ML analysis (goemotions/risk detail) is not
 * currently persisted in the database -- only emotion/sentimentScore/
 * insight are stored on the journal row (see journalController.js /
 * journalModel.js for why). As a result, this re-runs inference on every
 * one of today's journal entries each time today's analysis is
 * requested. If this endpoint ends up being polled frequently, consider
 * adding an `analysis_json` column to `journals` (via a migration) so
 * the full analysis can be cached at creation time instead of
 * recomputed here. That change was intentionally NOT made as part of
 * this integration to avoid an unnecessary schema change.
 *
 * @param {number|string} userId
 * @returns {Promise<{journalCount: number, journalAnalyses: Array, mlServiceAvailable: boolean}>}
 */
async function analyzeJournalsForToday(userId) {
  const journals = await journalModel.getTodayJournals(userId);

  if (!journals || journals.length === 0) {
    return {
      journalCount: 0,
      journalAnalyses: [],
      mlServiceAvailable: true,
    };
  }

  const journalAnalyses = [];
  let mlServiceAvailable = true;

  for (const journal of journals) {
    try {
      // eslint-disable-next-line no-await-in-loop -- intentionally
      // sequential: the Python inference server holds the models
      // in-process and is not guaranteed to handle concurrent requests
      // well, so we avoid hammering it with Promise.all().
      const analysis = await inferenceService.analyzeText(journal.content);
      journalAnalyses.push({ journalId: journal.id, analysis });
    } catch (err) {
      console.error(
        `Journal ML analysis failed for journal ${journal.id}:`,
        err.message
      );
      mlServiceAvailable = false;
      // Stop calling a service that appears to be down instead of
      // retrying it for every remaining journal entry today.
      break;
    }
  }

  return {
    journalCount: journals.length,
    journalAnalyses,
    mlServiceAvailable,
  };
}

/**
 * Combine today's mood records and today's journal ML analysis into a
 * single daily result.
 *
 * NOTE:
 * The exact weighting of the mood sources should be finalized with the
 * product team. This implementation deliberately keeps the combination
 * simple, deterministic, and transparent.
 *
 * @param {number|string} userId
 * @returns {Promise<object>}
 */
async function getTodayAnalysis(userId) {
  // ---------------------------------------------------------
  // 1. GET TODAY'S EXPLICIT MOOD RECORDS
  // ---------------------------------------------------------
  const moods = await moodModel.getTodayMoods(userId);

  // ---------------------------------------------------------
  // 2. ANALYZE TODAY'S JOURNALS VIA THE TRAINED ML MODELS
  // ---------------------------------------------------------
  const journalData = await analyzeJournalsForToday(userId);
  const analyses = journalData.journalAnalyses;

  // ---------------------------------------------------------
  // 3. NO DATA AT ALL
  // ---------------------------------------------------------
  if ((!moods || moods.length === 0) && journalData.journalCount === 0) {
    return {
      hasData: false,
      final: null,
      mood: { count: 0 },
      journals: {
        count: 0,
        mlServiceAvailable: journalData.mlServiceAvailable,
      },
    };
  }

  // ---------------------------------------------------------
  // 4. JOURNAL EMOTION SUMMARY (dominant primary emotion today)
  // ---------------------------------------------------------
  const emotionCounts = {};
  for (const item of analyses) {
    const emotion = item.analysis?.emotion?.emotion;
    if (!emotion) continue;
    emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
  }

  let journalEmotion = null;
  const emotionEntries = Object.entries(emotionCounts);
  if (emotionEntries.length > 0) {
    emotionEntries.sort((a, b) => b[1] - a[1]);
    journalEmotion = emotionEntries[0][0];
  }

  // ---------------------------------------------------------
  // 5. JOURNAL SENTIMENT SUMMARY (GoEmotions-derived)
  // ---------------------------------------------------------
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
  for (const item of analyses) {
    const sentiment = item.analysis?.sentiment?.label;
    if (sentiment && Object.prototype.hasOwnProperty.call(sentimentCounts, sentiment)) {
      sentimentCounts[sentiment]++;
    }
  }

  let journalSentiment = null;
  if (analyses.length > 0) {
    journalSentiment = Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0][0];
  }

  // ---------------------------------------------------------
  // 6. JOURNAL RISK SUMMARY
  //
  // Use the STRONGEST relevant risk signal, never an average -- a
  // single critical/high signal must not be diluted away by other,
  // lower-risk entries from the same day. This stays an engineering
  // screening indicator, never a diagnosis or clinical probability.
  // ---------------------------------------------------------
  let highestRiskScore = 0;
  let highestRiskLevel = "low";

  for (const item of analyses) {
    const risk = item.analysis?.risk;
    if (!risk) continue;

    const score = Number(risk.risk_score) || 0;
    if (score > highestRiskScore) {
      highestRiskScore = score;
    }

    const level = risk.risk_level || "low";
    if ((RISK_PRIORITY[level] ?? 0) > RISK_PRIORITY[highestRiskLevel]) {
      highestRiskLevel = level;
    }
  }

  // ---------------------------------------------------------
  // 7. EXPLICIT MOOD RECORD SUMMARY
  //
  // moodModel.getTodayMoods() returns rows ordered oldest -> newest, so
  // the last element is today's most recent explicit check-in.
  // ---------------------------------------------------------
  let moodEmotion = null;
  let moodScore = null;

  if (moods && moods.length > 0) {
    const latestMood = moods[moods.length - 1];
    moodEmotion = latestMood.emotion || null;
    if (latestMood.score !== null && latestMood.score !== undefined) {
      moodScore = Number(latestMood.score);
    }
  }

  // ---------------------------------------------------------
  // 8. FINAL EMOTION
  //
  // Prefer journal ML evidence (richer, text-based) when available;
  // otherwise fall back to the user's explicit mood signal. We never
  // invent a value when neither source has one.
  // ---------------------------------------------------------
  const finalEmotion = journalEmotion || moodEmotion || "unknown";

  // ---------------------------------------------------------
  // 9. FINAL SENTIMENT
  //
  // Sentiment is a GoEmotions-derived signal and only journals produce
  // it today; if there are no journals we default to "neutral" rather
  // than fabricating sentiment from an emoji/mood tag.
  // ---------------------------------------------------------
  const finalSentiment = journalSentiment || "neutral";

  // ---------------------------------------------------------
  // 10. FINAL CONCLUSION (deterministic, conservative, non-diagnostic)
  // ---------------------------------------------------------
  let conclusion;
  if (highestRiskLevel === "critical") {
    conclusion =
      "Today's entries indicate significant emotional distress and should receive prompt human attention.";
  } else if (highestRiskLevel === "high") {
    conclusion = "Today's entries indicate a high level of emotional distress.";
  } else if (highestRiskLevel === "elevated") {
    conclusion = "Today's entries indicate some elevated emotional distress.";
  } else if (finalSentiment === "negative") {
    conclusion = "Today's entries indicate a generally negative emotional state.";
  } else if (finalSentiment === "positive") {
    conclusion = "Today's entries indicate a generally positive emotional state.";
  } else {
    conclusion = "Today's entries indicate a generally neutral emotional state.";
  }

  // ---------------------------------------------------------
  // 11. RETURN FINAL DAILY ANALYSIS
  // ---------------------------------------------------------
  return {
    hasData: true,

    final: {
      emotion: finalEmotion,
      sentiment: finalSentiment,
      riskLevel: highestRiskLevel,
      riskScore: Math.round(highestRiskScore * 1000) / 1000,
      moodScore,
      conclusion,
      // Explicit, visible reminder that this is a heuristic screening
      // signal, not a diagnosis -- carried through from the Python risk
      // config/predictor.
      assessmentType: "screening_indicator",
    },

    mood: {
      count: moods?.length || 0,
      latestEmotion: moodEmotion,
      latestScore: moodScore,
    },

    journals: {
      count: journalData.journalCount,
      emotion: journalEmotion,
      sentiment: journalSentiment,
      analyses,
      mlServiceAvailable: journalData.mlServiceAvailable,
    },
  };
}

module.exports = {
  analyzeJournalsForToday,
  getTodayAnalysis,
};