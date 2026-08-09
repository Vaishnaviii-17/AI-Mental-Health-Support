const pool = require("../config/db");

/**
 * Create a new journal entry
 */
async function createJournal(
  userId,
  {
    title,
    content,
    mood,
    emotion,
    sentimentScore,
    insight,
    riskLevel,
    riskScore,
  }
) {
  const query = `
    INSERT INTO journals (
      user_id,
      title,
      content,
      mood,
      emotion,
      sentiment_score,
      insight,
      risk_level,
      risk_score
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `;

  const values = [
    userId,
    title,
    content,
    mood,
    emotion,
    sentimentScore,
    insight,
    riskLevel,
    riskScore,
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
}

/**
 * Get all journal entries for a user, newest first
 */
async function getJournals(userId) {
  const query = `
    SELECT *
    FROM journals
    WHERE user_id = $1
    ORDER BY created_at DESC;
  `;

  const { rows } = await pool.query(query, [userId]);
  return rows;
}

/**
 * Get a specific journal entry by ID
 */
async function getJournalById(id, userId) {
  const query = `
    SELECT *
    FROM journals
    WHERE id = $1 AND user_id = $2;
  `;

  const { rows } = await pool.query(query, [id, userId]);
  return rows[0] || null;
}

/**
 * Get today's journal entries for a user (server-local calendar day),
 * newest first. Used by moodAnalysisService to build today's combined
 * analysis.
 */
async function getTodayJournals(userId) {
  const query = `
    SELECT *
    FROM journals
    WHERE user_id = $1
      AND created_at::date = CURRENT_DATE
    ORDER BY created_at DESC;
  `;

  const { rows } = await pool.query(query, [userId]);
  return rows;
}

/**
 * Delete a journal entry
 */
async function deleteJournal(id, userId) {
  const query = `
    DELETE FROM journals
    WHERE id = $1 AND user_id = $2
    RETURNING id;
  `;

  const { rows } = await pool.query(query, [id, userId]);
  return rows[0] || null;
}

module.exports = {
  createJournal,
  getJournals,
  getJournalById,
  getTodayJournals,
  deleteJournal,
};