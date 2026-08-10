const pool = require("../config/db");

/**
 * Create a new user
 */
async function createUser({ username, password }) {
  const query = `
    INSERT INTO users (username, password)
    VALUES ($1, $2)
    RETURNING id, username, created_at;
  `;

  const values = [username, password];

  const { rows } = await pool.query(query, values);

  return rows[0];
}

/**
 * Find user by username
 */
async function findByUsername(username) {
  const query = `
    SELECT *
    FROM users
    WHERE username = $1;
  `;

  const { rows } = await pool.query(query, [username]);

  return rows[0] || null;
}

/**
 * Find user by ID
 * Anonymous-user system:
 * We only retrieve fields that exist in the users table.
 */
async function findById(id) {
  const query = `
    SELECT id, username, created_at
    FROM users
    WHERE id = $1;
  `;

  const { rows } = await pool.query(query, [id]);

  return rows[0] || null;
}

/**
 * Update password
 */
async function updatePassword(id, hashedPassword) {
  const query = `
    UPDATE users
    SET password = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, username;
  `;

  const { rows } = await pool.query(query, [hashedPassword, id]);

  return rows[0] || null;
}

/**
 * Update user profile
 * Anonymous-user system:
 * Only username is editable.
 */
async function updateProfile(id, { username }) {
  const query = `
    UPDATE users
    SET username = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, username, created_at, updated_at;
  `;

  const { rows } = await pool.query(query, [username, id]);

  return rows[0] || null;
}

/**
 * Delete user
 */
async function deleteUser(id) {
  const query = `
    DELETE FROM users
    WHERE id = $1;
  `;

  await pool.query(query, [id]);
}

module.exports = {
  createUser,
  findByUsername,
  findById,
  updatePassword,
  updateProfile,
  deleteUser,
};