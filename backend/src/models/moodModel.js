const pool = require("../config/db");

/**
 * Log a new mood.
 *
 * source:
 * - manual     -> user's daily mood check-in
 * - journal_ai -> mood generated from journal analysis
 */
async function createMood(
  userId,
  {
    emoji,
    emotion,
    score,
    confidence,
    insight,
    note,
    source = "journal_ai",
  }
) {
  const query = `
    INSERT INTO moods (
      user_id,
      emoji,
      emotion,
      score,
      confidence,
      insight,
      note,
      mood_date,
      source
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      CURRENT_DATE,
      $8
    )
    RETURNING *;
  `;

  const values = [
    userId,
    emoji,
    emotion,
    score,
    confidence ?? 100,
    insight || null,
    note || null,
    source,
  ];

  const { rows } = await pool.query(query, values);

  return rows[0];
}

/**
 * Get today's MANUAL mood for a user.
 *
 * Returns null if the user has not checked in today.
 */
async function getTodayMood(userId) {
  const query = `
    SELECT
      id,
      emoji,
      emotion,
      score,
      confidence,
      insight,
      note,
      mood_date,
      created_at,
      updated_at
    FROM moods
    WHERE user_id = $1
      AND mood_date = CURRENT_DATE
      AND source = 'manual'
    LIMIT 1;
  `;

  const { rows } = await pool.query(query, [userId]);

  return rows[0] || null;
}

/**
 * Create today's manual mood check-in.
 *
 * The database unique index guarantees that only
 * one manual mood can exist for a user on a given day.
 */
async function createDailyMood(
  userId,
  { emoji, emotion, score, note }
) {
  const query = `
    INSERT INTO moods (
      user_id,
      emoji,
      emotion,
      score,
      confidence,
      insight,
      note,
      mood_date,
      source
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      100,
      NULL,
      $5,
      CURRENT_DATE,
      'manual'
    )
    RETURNING
      id,
      emoji,
      emotion,
      score,
      confidence,
      insight,
      note,
      mood_date,
      created_at,
      updated_at;
  `;

  const values = [
    userId,
    emoji,
    emotion,
    score,
    note || null,
  ];

  const { rows } = await pool.query(query, values);

  return rows[0];
}

/**
 * Update today's manual mood.
 *
 * This does NOT create another row.
 * It updates the existing daily check-in.
 */
async function updateTodayMood(
  userId,
  { emoji, emotion, score, note }
) {
  const query = `
    UPDATE moods
    SET
      emoji = $1,
      emotion = $2,
      score = $3,
      note = $4,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $5
      AND mood_date = CURRENT_DATE
      AND source = 'manual'
    RETURNING
      id,
      emoji,
      emotion,
      score,
      confidence,
      insight,
      note,
      mood_date,
      created_at,
      updated_at;
  `;

  const values = [
    emoji,
    emotion,
    score,
    note || null,
    userId,
  ];

  const { rows } = await pool.query(query, values);

  return rows[0] || null;
}

/**
 * Fetch mood history for a user.
 */
async function getMoodHistory(userId) {
  const query = `
    SELECT
      id,
      emoji AS mood,
      emotion,
      score,
      insight,
      note,
      source,
      created_at AS "date"
    FROM moods
    WHERE user_id = $1
    ORDER BY created_at DESC;
  `;

  const { rows } = await pool.query(query, [userId]);

  return rows;
}

/**
 * Calculate aggregate mood analytics for a user.
 */
async function getMoodStats(userId) {
  // 1. Get average mood score
  const avgRes = await pool.query(
    `
      SELECT
        ROUND(AVG(score)::numeric, 1)::float AS avg_score
      FROM moods
      WHERE user_id = $1
    `,
    [userId]
  );

  const avgScore = avgRes.rows[0]?.avg_score || 0;

  // 2. Get most common emotion
  const commonRes = await pool.query(
    `
      SELECT emotion, COUNT(*) AS cnt
      FROM moods
      WHERE user_id = $1
      GROUP BY emotion
      ORDER BY cnt DESC, emotion ASC
      LIMIT 1
    `,
    [userId]
  );

  const mostCommon =
    commonRes.rows[0]?.emotion || "None";

  // 3. Total mood check-ins
  const countRes = await pool.query(
    `
      SELECT COUNT(*)::int AS total_count
      FROM moods
      WHERE user_id = $1
    `,
    [userId]
  );

  const checkinsCount =
    countRes.rows[0]?.total_count || 0;

  // 4. Last 7 check-ins
  const weeklyRes = await pool.query(
    `
      SELECT score, created_at
      FROM moods
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 7
    `,
    [userId]
  );

  const daysOfWeek = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ];

  const weeklyScores = weeklyRes.rows
    .reverse()
    .map((m, idx, arr) => {
      const d = new Date(m.created_at);

      const label =
        idx === arr.length - 1 &&
        d.toDateString() === new Date().toDateString()
          ? "Today"
          : daysOfWeek[d.getDay()];

      return {
        label,
        score: m.score,
      };
    });

  // 5. Emotion distribution
  const distRes = await pool.query(
    `
      SELECT emotion, COUNT(*)::int AS count
      FROM moods
      WHERE user_id = $1
      GROUP BY emotion
    `,
    [userId]
  );

  const emotionDistribution = {};

  distRes.rows.forEach((row) => {
    emotionDistribution[row.emotion] = row.count;
  });

  // 6. Trend
  const trendRes = await pool.query(
    `
      SELECT score
      FROM moods
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 14
    `,
    [userId]
  );

  let trend = "Stable";

  if (trendRes.rows.length >= 2) {
    const scores = trendRes.rows.map((row) => row.score);

    const thisWeekScores = scores.slice(0, 7);
    const prevWeekScores = scores.slice(7);

    const thisWeekAvg =
      thisWeekScores.reduce((a, b) => a + b, 0) /
      thisWeekScores.length;

    const prevWeekAvg =
      prevWeekScores.length > 0
        ? prevWeekScores.reduce((a, b) => a + b, 0) /
          prevWeekScores.length
        : thisWeekAvg;

    const diff = thisWeekAvg - prevWeekAvg;

    if (diff > 0.2) {
      trend = "Improving";
    } else if (diff < -0.2) {
      trend = "Declining";
    }
  }

  return {
    avgScore,
    mostCommon,
    checkinsCount,
    weeklyScores,
    emotionDistribution,
    trend,
  };
}

/**
 * Get daily activity counts for the last 12 months.
 */
async function getActivityCalendar(userId) {
  const query = `
    WITH activity AS (
      SELECT
        DATE(created_at) AS day,
        COUNT(*) AS cnt
      FROM journals
      WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE(created_at)

      UNION ALL

      SELECT
        DATE(created_at) AS day,
        COUNT(*) AS cnt
      FROM moods
      WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE(created_at)

      UNION ALL

      SELECT
        DATE(created_at) AS day,
        COUNT(*) AS cnt
      FROM chats
      WHERE user_id = $1
        AND sender = 'user'
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE(created_at)
    )

    SELECT
      day::text AS date,
      SUM(cnt)::int AS count
    FROM activity
    GROUP BY day
    ORDER BY day ASC;
  `;

  const { rows } = await pool.query(query, [userId]);

  return rows;
}

module.exports = {
  createMood,
  getTodayMood,
  createDailyMood,
  updateTodayMood,
  getMoodHistory,
  getMoodStats,
  getActivityCalendar,
};