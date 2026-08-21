const pool = require("../config/db");

/**
 * Add a new chat message to history
 */
async function addMessage(userId, { sender, message, isCrisis, sessionId, emotion, score }) {
  const query = `
    INSERT INTO chats (user_id, sender, message, is_crisis, session_id, emotion, score)
    VALUES ($1, $2, $3, $4, COALESCE($5, gen_random_uuid()), $6, $7)
    RETURNING *;
  `;

  const values = [
    userId,
    sender,
    message,
    isCrisis || false,
    sessionId || null,
    emotion || null,
    score || null
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

/**
 * Fetch chat history for a user, oldest first (chronological for chat flow)
 */
async function getChatHistory(userId) {
  const query = `
    SELECT id, user_id, sender, message, is_crisis, session_id, created_at
    FROM chats
    WHERE user_id = $1
    ORDER BY created_at ASC;
  `;

  const { rows } = await pool.query(query, [userId]);
  return rows;
}

/**
 * Clear all chat history for a user
 */
async function clearChat(userId) {
  const query = `
    DELETE FROM chats
    WHERE user_id = $1;
  `;

  await pool.query(query, [userId]);
}

/**
 * Clear a specific chat session for a user
 */
async function deleteSession(userId, sessionId) {
  const query = `
    DELETE FROM chats
    WHERE user_id = $1 AND session_id = $2;
  `;

  await pool.query(query, [userId, sessionId]);
}

module.exports = {
  addMessage,
  getChatHistory,
  clearChat,
  deleteSession,
};
