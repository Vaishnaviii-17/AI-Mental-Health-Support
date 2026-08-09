/**
 * mlMapping.js
 *
 * Helpers for mapping trained-model output onto the existing
 * journal/mood database schema.
 *
 * -----------------------------------------------------------------
 * EMOTION RESOLUTION AUTHORITY
 * -----------------------------------------------------------------
 *
 * The primary-vs-GoEmotions ambiguity decision (confidence < 0.60
 * OR margin < 0.15) and the GoEmotions -> six-class fallback
 * mapping are decided EXACTLY ONCE, in predictor.py
 * (PRIMARY_CONFIDENCE_THRESHOLD, PRIMARY_MARGIN_THRESHOLD, and
 * GOEMOTIONS_TO_SIX_MAP).
 *
 * This file does NOT re-evaluate ambiguity and does NOT maintain
 * its own GoEmotions -> six-class mapping. It only reads the
 * final decision Python already made, available at:
 *
 *   analysis.emotion.emotion      -> one of the six supported
 *                                     labels, always
 *   analysis.emotion.confidence   -> confidence of whichever
 *                                     source was used
 *   analysis.emotion.source       -> "primary_model" or
 *                                     "goemotions_fallback"
 *   analysis.emotion.fallback_reason (present only when source is
 *                                     "goemotions_fallback")
 *
 * Previously this file duplicated that decision (with a *different*
 * margin threshold, 0.10, and a second, separately-maintained
 * GoEmotions map) which meant the DB-stored emotion, the emotion
 * printed in Python's own logs, and the emotion in the API
 * response could all disagree. That duplication has been removed.
 *
 * This is NOT a clinical assessment.
 */

const EMOTION_EMOJI_MAP = {
  sadness: "😢",
  joy: "😄",
  love: "🥰",
  anger: "😠",
  fear: "😨",
  surprise: "😲",
};

// The six-class schema the database/frontend already expect.
// Used only as a validity guard on Python's output -- NOT as a
// second mapping table. If predictor.py ever returns something
// outside this set, we fail safe (null) rather than silently
// storing an arbitrary GoEmotions label like "approval" or
// "neutral" into the existing `emotion` column.
const SUPPORTED_EMOTIONS = new Set(
  Object.keys(EMOTION_EMOJI_MAP)
);


/**
 * Convert emotion → emoji.
 */
function emotionToEmoji(emotion) {
  if (!emotion) return null;

  return EMOTION_EMOJI_MAP[emotion] || null;
}


/**
 * Resolve the final application emotion.
 *
 * Python (predictor.py) has already decided the final emotion --
 * whether it came straight from the confident primary model or
 * from the mapped GoEmotions fallback -- and already guarantees
 * `analysis.emotion.emotion` is one of the six supported labels.
 * This function's job is just to read that decision safely, not
 * to recompute it.
 *
 * Returns:
 *
 * {
 *   emotion,             // one of the six labels, or null
 *   source,              // "primary_model" | "goemotions_fallback" | null
 *   confidence,          // confidence of whichever source was used
 *   primaryEmotion,      // what the primary 6-class model predicted
 *   primaryConfidence,   // primary model's own confidence
 *   fallbackReason,      // e.g. "ambiguous_margin", null if no fallback
 *   fallbackWasAmbiguous // true if even the GoEmotions fallback was weak
 * }
 */
function resolveEmotion(analysis) {
  const rawEmotion = analysis?.emotion?.emotion || null;

  const source = analysis?.emotion?.source || null;

  const confidence = Number(analysis?.emotion?.confidence);

  const primaryEmotion =
    analysis?.emotion?.primary_model_prediction ?? rawEmotion;

  const primaryConfidence = Number(
    analysis?.emotion?.primary_model_confidence
  );

  const fallbackReason =
    source === "goemotions_fallback"
      ? analysis?.emotion?.fallback_reason || null
      : null;

  const fallbackWasAmbiguous =
    source === "goemotions_fallback"
      ? Boolean(analysis?.emotion?.fallback_was_ambiguous)
      : false;

  // Safety net, not a second mapping: Python guarantees this is
  // always one of the six labels. If that contract is ever
  // violated (bad upstream response, stale server, etc.) we do
  // not want to store an out-of-schema value.
  const emotion = SUPPORTED_EMOTIONS.has(rawEmotion)
    ? rawEmotion
    : null;

  if (rawEmotion && !emotion) {
    console.error(
      "mlMapping: predictor returned an out-of-schema emotion, " +
        "dropping it instead of storing it:",
      rawEmotion
    );
  }

  return {
    emotion,
    source,
    confidence: Number.isFinite(confidence) ? confidence : null,
    primaryEmotion,
    primaryConfidence: Number.isFinite(primaryConfidence)
      ? primaryConfidence
      : null,
    fallbackReason,
    fallbackWasAmbiguous,
  };
}


/**
 * Convert sentiment into the existing 1–5 journal score.
 */
function sentimentToScore(scores) {
  if (!scores) return null;

  const positive = Number(scores.positive) || 0;
  const negative = Number(scores.negative) || 0;
  const neutral = Number(scores.neutral) || 0;

  if (negative > positive && negative > neutral) {
    if (negative >= 0.75) return 1;
    return 2;
  }

  if (positive > negative && positive > neutral) {
    if (positive >= 0.75) return 5;
    return 4;
  }

  return 3;
}


/**
 * Build automated journal summary.
 *
 * Wording explicitly reflects whether the final emotion came
 * straight from the primary model or from the GoEmotions
 * fallback, instead of always claiming a "primary emotion" was
 * detected.
 */
function buildJournalSummary(analysis) {
  const resolved = resolveEmotion(analysis);

  const emotion = resolved.emotion || "unknown";

  const sentimentLabel =
    analysis?.sentiment?.label || "neutral";

  const riskLevel =
    analysis?.risk?.risk_level || "low";

  let summary = `Automated summary: emotion detected as "${emotion}"`;

  if (resolved.source === "goemotions_fallback") {
    summary +=
      " (the primary model's prediction was ambiguous, so this" +
      " was resolved using GoEmotions as a fallback signal)";
  } else if (resolved.confidence !== null) {
    const confidencePct = Math.round(resolved.confidence * 100);
    summary += ` (${confidencePct}% model confidence)`;
  }

  summary += `, overall tone ${sentimentLabel}.`;

  if (riskLevel !== "low") {
    summary +=
      ` Engineering risk screening flagged this entry as "${riskLevel}" risk.` +
      ` This is a heuristic screening indicator, not a clinical assessment.`;
  }

  return summary;
}


module.exports = {
  EMOTION_EMOJI_MAP,
  emotionToEmoji,
  sentimentToScore,
  buildJournalSummary,
  resolveEmotion,
};