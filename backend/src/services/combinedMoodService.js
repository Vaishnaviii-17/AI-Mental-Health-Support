const pool = require("../config/db");
const { emotionToScore, scoreToMoodDetails } = require("../utils/mlMapping");

/**
 * Calculates the combined mood score for a user on a specific date (YYYY-MM-DD).
 * Returns null if no activity occurred.
 */
async function getCombinedMoodForDate(userId, dateStr) {
  // 1. Fetch manual mood check-in
  const checkinRes = await pool.query(
    `SELECT score, emotion, emoji, note, created_at
     FROM moods
     WHERE user_id = $1 AND mood_date = $2 AND source = 'manual'
     LIMIT 1`,
    [userId, dateStr]
  );
  
  const checkinRow = checkinRes.rows[0];
  const checkinScore = checkinRow ? Number(checkinRow.score) : null;

  // 2. Fetch journal entries
  const journalRes = await pool.query(
    `SELECT emotion, sentiment_score
     FROM journals
     WHERE user_id = $1 AND created_at::date = $2`,
    [userId, dateStr]
  );
  
  let journalScore = null;
  if (journalRes.rows.length > 0) {
    const scores = journalRes.rows.map(r => emotionToScore(r.emotion));
    journalScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  }

  // 3. Fetch chat messages (sender = 'user')
  const chatRes = await pool.query(
    `SELECT score
     FROM chats
     WHERE user_id = $1 AND sender = 'user' AND created_at::date = $2 AND score IS NOT NULL`,
    [userId, dateStr]
  );
  
  let chatScore = null;
  if (chatRes.rows.length > 0) {
    const scores = chatRes.rows.map(r => Number(r.score));
    chatScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  }

  // Calculate weights
  let sumWeights = 0;
  let weightedSum = 0;
  const sources = {
    checkin: false,
    journal: false,
    chat: false
  };

  if (checkinScore !== null) {
    sumWeights += 40;
    weightedSum += checkinScore * 40;
    sources.checkin = true;
  }
  if (journalScore !== null) {
    sumWeights += 35;
    weightedSum += journalScore * 35;
    sources.journal = true;
  }
  if (chatScore !== null) {
    sumWeights += 25;
    weightedSum += chatScore * 25;
    sources.chat = true;
  }

  if (sumWeights === 0) {
    return null; // No activity today
  }

  // Calculate combined score
  const combinedScore = Math.round((weightedSum / sumWeights) * 10) / 10;
  const moodDetails = scoreToMoodDetails(combinedScore);

  // For detected_at timestamp, use check-in or first activity time
  const detectedAt = checkinRow ? checkinRow.created_at : dateStr;

  return {
    score: combinedScore,
    emotion: moodDetails.emotion,
    emoji: moodDetails.emoji,
    sources,
    isCombined: true,
    detected_at: detectedAt,
    note: checkinRow?.note || null
  };
}

module.exports = {
  getCombinedMoodForDate
};
