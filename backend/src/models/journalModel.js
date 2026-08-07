const pool = require("../config/db");

/**
 * Create a new journal entry
 */
async function createJournal(userId, { title, content, mood, emotion, sentimentScore, insight }) {
  const query = `
    INSERT INTO journals (user_id, title, content, mood, emotion, sentiment_score, insight)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;

  const values = [userId, title, content, mood, emotion, sentimentScore, insight];
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
  deleteJournal,
};
