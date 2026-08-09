const pool = require("../config/db");

/**
 * Log a new mood check-in
 */
async function createMood(userId, { emoji, emotion, score, confidence, insight }) {
  const query = `
    INSERT INTO moods (user_id, emoji, emotion, score, confidence, insight)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;

  const values = [userId, emoji, emotion, score, confidence || 100, insight];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

/**
 * Fetch mood check-in history for a user, newest first
 */
async function getMoodHistory(userId) {
  const query = `
    SELECT id, emoji as mood, emotion, score, insight, created_at as "date"
    FROM moods
    WHERE user_id = $1
    ORDER BY created_at DESC;
  `;

  const { rows } = await pool.query(query, [userId]);
  return rows;
}

/**
 * Get today's mood check-ins for a user (server-local calendar day),
 * OLDEST first, so callers can treat the last element as "latest".
 * Used by moodAnalysisService to build today's combined analysis.
 */
async function getTodayMoods(userId) {
  const query = `
    SELECT *
    FROM moods
    WHERE user_id = $1
      AND created_at::date = CURRENT_DATE
    ORDER BY created_at ASC;
  `;

  const { rows } = await pool.query(query, [userId]);
  return rows;
}

/**
 * Calculate aggregate mood analytics for a user
 */
async function getMoodStats(userId) {
  // 1. Get average mood score
  const avgRes = await pool.query(
    "SELECT ROUND(AVG(score)::numeric, 1)::float as avg_score FROM moods WHERE user_id = $1",
    [userId]
  );
  const avgScore = avgRes.rows[0]?.avg_score || 0;

  // 2. Get most common emotion
  const commonRes = await pool.query(`
    SELECT emotion, COUNT(*) as cnt
    FROM moods
    WHERE user_id = $1
    GROUP BY emotion
    ORDER BY cnt DESC, emotion ASC
    LIMIT 1
  `, [userId]);
  const mostCommon = commonRes.rows[0]?.emotion || "None";

  // 3. Get total mood check-ins
  const countRes = await pool.query(
    "SELECT COUNT(*)::int as total_count FROM moods WHERE user_id = $1",
    [userId]
  );
  const checkinsCount = countRes.rows[0]?.total_count || 0;

  // 4. Get last 7 check-ins for the weekly chart (chronological order)
  const weeklyRes = await pool.query(`
    SELECT score, created_at
    FROM moods
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 7
  `, [userId]);
  
  // Format weekly scores for frontend chart labels (e.g. Day name)
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyScores = weeklyRes.rows.reverse().map((m, idx, arr) => {
    const d = new Date(m.created_at);
    // If it's the last element, label it "Today" or use the day of week
    const label = (idx === arr.length - 1 && d.toDateString() === new Date().toDateString()) 
      ? "Today" 
      : daysOfWeek[d.getDay()];
    return {
      label,
      score: m.score
    };
  });

  // 5. Get emotion distribution counts
  const distRes = await pool.query(`
    SELECT emotion, COUNT(*)::int as count
    FROM moods
    WHERE user_id = $1
    GROUP BY emotion
  `, [userId]);
  
  const emotionDistribution = {};
  distRes.rows.forEach(r => {
    emotionDistribution[r.emotion] = r.count;
  });

  // 6. Calculate trend comparing last 7 check-ins to the 7 check-ins before that
  const trendRes = await pool.query(`
    SELECT score FROM moods
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 14
  `, [userId]);

  let trend = "Stable";
  if (trendRes.rows.length >= 2) {
    const scores = trendRes.rows.map(r => r.score);
    const thisWeekScores = scores.slice(0, 7);
    const prevWeekScores = scores.slice(7);

    const thisWeekAvg = thisWeekScores.reduce((a, b) => a + b, 0) / thisWeekScores.length;
    const prevWeekAvg = prevWeekScores.length > 0 
      ? prevWeekScores.reduce((a, b) => a + b, 0) / prevWeekScores.length 
      : thisWeekAvg; // Fallback if no prev week scores

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
    trend
  };
}

/**
 * Get daily activity counts for the last 12 months
 * Aggregates journal entries + mood check-ins + chat messages per calendar day
 */
async function getActivityCalendar(userId) {
  const query = `
    WITH activity AS (
      SELECT DATE(created_at) as day, COUNT(*) as cnt
      FROM journals
      WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE(created_at)

      UNION ALL

      SELECT DATE(created_at) as day, COUNT(*) as cnt
      FROM moods
      WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE(created_at)

      UNION ALL

      SELECT DATE(created_at) as day, COUNT(*) as cnt
      FROM chats
      WHERE user_id = $1
        AND sender = 'user'
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE(created_at)
    )
    SELECT day::text as date, SUM(cnt)::int as count
    FROM activity
    GROUP BY day
    ORDER BY day ASC;
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
}

module.exports = {
  createMood,
  getMoodHistory,
  getTodayMoods,
  getMoodStats,
  getActivityCalendar,
};