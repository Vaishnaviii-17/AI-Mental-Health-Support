const pool = require("../config/db");

/**
 * NOTE ON SCHEMA: this table has (or requires) two JSONB columns
 * beyond the original text/emoji/score fields:
 *
 *   secondary_emotions JSONB  -- array of { label, probability }
 *                                objects from the GoEmotions-only
 *                                emotion resolution in predictor.py.
 *
 *   risk_analysis JSONB       -- the complete risk screening object
 *                                from calculate_risk_assessment() in
 *                                predictor.py (risk_score, risk_level,
 *                                detected_risk_categories, etc). This
 *                                is a heuristic screening indicator,
 *                                not a clinical assessment.
 *
 * If the `journals` table does not yet have these columns, run:
 *
 *   ALTER TABLE journals
 *     ADD COLUMN IF NOT EXISTS secondary_emotions JSONB DEFAULT '[]'::jsonb;
 *
 *   ALTER TABLE journals
 *     ADD COLUMN IF NOT EXISTS risk_analysis JSONB;
 *
 * (see migrations/xxxx_add_risk_analysis_to_journals.sql for the
 * risk_analysis migration if this project has a migration runner.)
 */

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
    secondaryEmotions,
    sentimentScore,
    riskAnalysis,
    insight,
  }
) {
  const query = `
    INSERT INTO journals (
      user_id, title, content, mood, emotion,
      secondary_emotions, sentiment_score, risk_analysis, insight
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
    JSON.stringify(secondaryEmotions || []),
    sentimentScore,
    JSON.stringify(riskAnalysis || {}),
    insight,
  ];
    
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
    secondaryEmotions,
    sentimentScore,
    riskAnalysis,
    insight,
  }
) {
  const query = `
    INSERT INTO journals (
      user_id,
      title,
      content,
      mood,
      emotion,
      secondary_emotions,
      sentiment_score,
      risk_analysis,
      insight
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
    JSON.stringify(secondaryEmotions || []),
    sentimentScore,
    riskAnalysis ? JSON.stringify(riskAnalysis) : null,
    insight,
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
