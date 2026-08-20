/**
 * mlMapping.js
 *
 * Helpers for mapping trained-model output onto the existing
 * journal/mood database schema.
 *
 * ---------------------------------------------------------------
 * EMOTION RESOLUTION AUTHORITY
 * ---------------------------------------------------------------
 * GoEmotions is the SOLE source of emotion detection (see
 * predictor.py). Python already resolves the dominant emotion and
 * secondary/supporting emotions directly from raw GoEmotions
 * probabilities -- this file does NOT re-run that decision, it
 * only reads it.
 *
 * ---------------------------------------------------------------
 * RISK RESOLUTION AUTHORITY
 * ---------------------------------------------------------------
 * Risk screening is calculated ENTIRELY in Python
 * (calculate_risk_assessment() in predictor.py) and is a heuristic
 * SCREENING indicator, never a clinical assessment. This file does
 * NOT recompute, re-weight, or duplicate that logic -- resolveRisk()
 * below only reads analysis.risk and fills in safe defaults so the
 * rest of the app doesn't have to null-check it everywhere.
 *
 * This is NOT a clinical assessment.
 */

// Display emoji for GoEmotions' native labels (28 fine-grained
// labels + neutral). This is a UI presentation concern only.
const EMOTION_EMOJI_MAP = {
  admiration: "🤩",
  amusement: "😄",
  anger: "😠",
  annoyance: "😒",
  approval: "👍",
  caring: "🥰",
  confusion: "😕",
  curiosity: "🤔",
  desire: "😍",
  disappointment: "😞",
  disapproval: "👎",
  disgust: "🤢",
  embarrassment: "😳",
  excitement: "🤗",
  fear: "😨",
  gratitude: "🙏",
  grief: "💔",
  joy: "😄",
  love: "🥰",
  nervousness: "😬",
  optimism: "🌤️",
  pride: "😌",
  realization: "💡",
  relief: "😮‍💨",
  remorse: "😔",
  sadness: "😢",
  surprise: "😲",
  neutral: "😐",
};

const DEFAULT_EMOTION_EMOJI = "🙂";

function emotionToEmoji(emotion) {
  if (!emotion) return null;
  return EMOTION_EMOJI_MAP[emotion] || DEFAULT_EMOTION_EMOJI;
}

/**
 * Resolve the final application emotion.
 *
 * Python (predictor.py) has already decided the dominant emotion
 * and its secondary/supporting emotions directly from GoEmotions.
 * This function's job is just to read that decision safely.
 */
function resolveEmotion(analysis) {
  const emotion = analysis?.emotion?.label || null;

  const source = analysis?.emotion?.source || null;

  const rawProbability = analysis?.emotion?.probability;
  const probability =
    rawProbability === null || rawProbability === undefined
      ? null
      : Number(rawProbability);

  const secondaryEmotions = Array.isArray(
    analysis?.goemotions?.secondary_emotions
  )
    ? analysis.goemotions.secondary_emotions
    : [];

  return {
    emotion,
    probability: Number.isFinite(probability) ? probability : null,
    source,
    secondaryEmotions,
  };
}

/**
 * Human-readable labels for risk categories returned by
 * predictor.py's RISK_PATTERNS. Used so the UI never has to show
 * a raw category key or, worse, a regex pattern to the user.
 */
const RISK_CATEGORY_LABELS = {
  suicidal_ideation: "Thoughts of not wanting to live",
  self_harm: "Self-harm related language",
  hopelessness: "Hopelessness",
  feeling_trapped: "Feeling trapped",
  severe_distress: "Severe distress",
};

function riskCategoryLabel(category) {
  return RISK_CATEGORY_LABELS[category] || category;
}

/**
 * Resolve the risk screening result for display/persistence.
 *
 * Risk is calculated ENTIRELY by Python (see predictor.py /
 * calculate_risk_assessment()). This function only reads
 * analysis.risk and returns a safe, fully-defaulted shape -- it
 * never recomputes risk_score/risk_level itself.
 *
 * Returns:
 * {
 *   riskScore,          // number 0-1, or null if unavailable
 *   riskLevel,          // "low" | "elevated" | "high" | "critical" | null
 *   detectedCategories, // [{ key, label }, ...]
 *   protectiveSignals,  // number
 *   raw,                // the original analysis.risk object, or null
 * }
 */
function resolveRisk(analysis) {
  const risk = analysis?.risk || null;

  if (!risk) {
    return {
      riskScore: null,
      riskLevel: null,
      detectedCategories: [],
      protectiveSignals: 0,
      raw: null,
    };
  }

  const rawScore = risk.risk_score;
  const riskScore =
    rawScore === null || rawScore === undefined ? null : Number(rawScore);

  const detectedCategories = Array.isArray(risk.detected_risk_categories)
    ? risk.detected_risk_categories.map((key) => ({
        key,
        label: riskCategoryLabel(key),
      }))
    : [];

  return {
    riskScore: Number.isFinite(riskScore) ? riskScore : null,
    riskLevel: risk.risk_level || null,
    detectedCategories,
    protectiveSignals: Number(risk.protective_text_signals) || 0,
    raw: risk,
  };
}

/**
 * Convert sentiment into the existing 1-5 journal score.
 *
 * Sentiment remains a separate signal from emotion and from risk --
 * derived from GoEmotions' own positive/negative/neutral emotion
 * groupings (see calculate_sentiment in predictor.py).
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
 * Build the natural-language journal reflection/insight text that
 * gets persisted and shown in the "Reflection" line of the AI Mood
 * Reflection panel.
 *
 * ---------------------------------------------------------------
 * REFLECTION AUTHORITY
 * ---------------------------------------------------------------
 * As of the long-entry emotion aggregation change, predictor.py
 * already generates a short, deterministic, template-based 2-3
 * line reflection from the actual detected dominant/secondary
 * emotions (see generate_emotional_reflection() in predictor.py --
 * this is what correctly reflects long, multi-emotion entries
 * instead of collapsing them to one dominant label). This function
 * just reads analysis.reflection.summary, the same way
 * resolveEmotion()/resolveRisk() only read Python's decisions
 * rather than recomputing them.
 *
 * A defensive fallback (the previous robotic "Automated summary:
 * ..." sentence) is kept for the unlikely case an older inference
 * server response doesn't include `reflection` yet, so this never
 * throws and old/in-flight responses don't break the UI.
 *
 * Risk mentions (when not low) are appended as before, worded as a
 * heuristic screening indicator, never a diagnosis. The Risk
 * Screening panel itself remains the primary place risk is shown --
 * this is just a one-line pointer within the emotion reflection.
 */
function buildJournalSummary(analysis) {
  const risk = resolveRisk(analysis);

  const generatedReflection =
    typeof analysis?.reflection?.summary === "string" &&
    analysis.reflection.summary.trim()
      ? analysis.reflection.summary.trim()
      : null;

  let summary = generatedReflection || legacyEmotionSummary(analysis);

  if (risk.riskLevel && risk.riskLevel !== "low") {
    summary +=
      ` Risk screening flagged this entry as "${risk.riskLevel}".` +
      ` This is a heuristic screening indicator, not a clinical assessment.`;
  }

  return summary;
}

/**
 * Fallback only -- used if analysis.reflection.summary is ever
 * missing (e.g. an older inference server response). Not used in
 * the normal path once predictor.py returns `reflection`.
 */
function legacyEmotionSummary(analysis) {
  const resolved = resolveEmotion(analysis);
  const emotion = resolved.emotion || "neutral";
  const sentimentLabel = analysis?.sentiment?.label || "neutral";

  let summary = `Automated summary: dominant emotion detected as "${emotion}"`;

  if (resolved.probability !== null) {
    const scorePct = Math.round(resolved.probability * 100);
    summary += ` (${scorePct}% model score)`;
  }

  if (resolved.secondaryEmotions.length > 0) {
    const secondaryList = resolved.secondaryEmotions
      .map((item) => item.label)
      .join(", ");
    summary += `, with supporting signals of ${secondaryList}`;
  }

  summary += `, overall tone ${sentimentLabel}.`;

  return summary;
}

const EMOTION_SCORE_MAP = {
  // Positive emotions -> 5 or 4
  joy: 5,
  excitement: 5,
  love: 5,
  pride: 5,
  relief: 5,
  amusement: 5,
  caring: 5,
  admiration: 5,
  approval: 4,
  desire: 4,
  gratitude: 4,
  optimism: 4,

  // Neutral emotions -> 3
  neutral: 3,
  curiosity: 3,
  realization: 3,
  surprise: 3,
  confusion: 3,

  // Negative emotions -> 2 or 1
  annoyance: 2,
  disapproval: 2,
  embarrassment: 2,
  nervousness: 2,
  disgust: 2,
  anger: 2,
  sadness: 1,
  grief: 1,
  fear: 1,
  disappointment: 1,
  remorse: 1,
};

function emotionToScore(emotion) {
  if (!emotion) return 3;
  const cleanEmotion = emotion.toLowerCase().trim();
  return EMOTION_SCORE_MAP[cleanEmotion] ?? 3;
}

function scoreToMoodDetails(score) {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return { emotion: "Neutral", emoji: "😐" };
  }
  const numericScore = Number(score);
  if (numericScore >= 4.5) {
    return { emotion: "Very Happy", emoji: "😊" };
  } else if (numericScore >= 3.5) {
    return { emotion: "Good", emoji: "🙂" };
  } else if (numericScore >= 2.5) {
    return { emotion: "Neutral", emoji: "😐" };
  } else if (numericScore >= 1.5) {
    return { emotion: "Sad", emoji: "😔" };
  } else {
    return { emotion: "Very Sad", emoji: "😢" };
  }
}

module.exports = {
  EMOTION_EMOJI_MAP,
  DEFAULT_EMOTION_EMOJI,
  RISK_CATEGORY_LABELS,
  EMOTION_SCORE_MAP,
  emotionToEmoji,
  riskCategoryLabel,
  sentimentToScore,
  buildJournalSummary,
  resolveEmotion,
  resolveRisk,
  emotionToScore,
  scoreToMoodDetails,
};