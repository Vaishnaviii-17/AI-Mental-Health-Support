const pool = require("../config/db");

/**
 * Creates an activity session and checks if it is a personal best in a transaction.
 */
async function createSession(userId, { activityType, score, durationSeconds, completed, metadata }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Fetch previous best score for this user & activity
    const bestQuery = `
      SELECT MAX(score) as previous_best
      FROM activity_sessions
      WHERE user_id = $1 AND activity_type = $2;
    `;
    const bestRes = await client.query(bestQuery, [userId, activityType]);
    const previousBestRaw = bestRes.rows[0]?.previous_best;
    const previousBest = previousBestRaw !== null && previousBestRaw !== undefined ? Number(previousBestRaw) : null;

    // 2. Insert new session
    const insertQuery = `
      INSERT INTO activity_sessions (user_id, activity_type, score, duration_seconds, completed, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, activity_type, score, duration_seconds, completed, metadata, created_at;
    `;
    const insertRes = await client.query(insertQuery, [
      userId,
      activityType,
      score,
      durationSeconds,
      completed,
      JSON.stringify(metadata || {})
    ]);

    await client.query("COMMIT");

    const newSession = insertRes.rows[0];
    
    // A first-ever score (previousBest === null) is NOT a "New Personal Best"
    const isNewPersonalBest = previousBest !== null && score > previousBest;

    return {
      session: newSession,
      isNewPersonalBest,
      previousBest
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Creates a feedback rating for an activity session.
 */
async function createFeedback(userId, { activitySessionId, rating }) {
  // First ensure the session belongs to this user
  const sessionCheck = await pool.query(
    "SELECT id FROM activity_sessions WHERE id = $1 AND user_id = $2",
    [activitySessionId, userId]
  );
  if (sessionCheck.rows.length === 0) {
    throw new Error("Activity session not found or access denied.");
  }

  const query = `
    INSERT INTO activity_feedback (user_id, activity_session_id, rating)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, activity_session_id, rating, created_at;
  `;
  const { rows } = await pool.query(query, [userId, activitySessionId, rating]);
  return rows[0];
}

/**
 * Gets paginated session history for a user.
 */
async function getSessionHistory(userId, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  // Query count first
  const countQuery = "SELECT COUNT(*) FROM activity_sessions WHERE user_id = $1";
  const countRes = await pool.query(countQuery, [userId]);
  const total = parseInt(countRes.rows[0].count, 10);

  // Query actual records
  const query = `
    SELECT id, activity_type, score, duration_seconds, completed, metadata, created_at
    FROM activity_sessions
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const { rows } = await pool.query(query, [userId, limit, offset]);

  return {
    sessions: rows,
    page,
    limit,
    total,
    hasMore: offset + rows.length < total
  };
}

/**
 * Gets aggregate statistics for a specific activity type.
 */
async function getBestStats(userId, activityType) {
  if (activityType === "pop_stress") {
    const query = `
      SELECT
        COALESCE(MAX(score), 0)::int as "bestScore",
        COUNT(*)::int as "gamesPlayed",
        COALESCE(MAX(duration_seconds), 0)::int as "bestSurvivalTime",
        COALESCE(SUM((metadata->>'balloons_popped')::int), 0)::int as "totalBalloons"
      FROM activity_sessions
      WHERE user_id = $1 AND activity_type = $2;
    `;
    const { rows } = await pool.query(query, [userId, activityType]);
    return rows[0];
  }

  if (activityType === "memory_match") {
    const query = `
      SELECT
        COALESCE(MAX(score), 0)::int as "bestScore",
        COALESCE(MIN(CASE WHEN completed = true THEN duration_seconds END), 0)::int as "bestTime",
        COALESCE(MIN(CASE WHEN completed = true THEN (metadata->>'attempts')::int END), 0)::int as "fewestAttempts",
        COUNT(*)::int as "gamesPlayed"
      FROM activity_sessions
      WHERE user_id = $1 AND activity_type = $2;
    `;
    const { rows } = await pool.query(query, [userId, activityType]);
    return rows[0];
  }

  if (activityType === "breathing_bubble") {
    const query = `
      SELECT
        COALESCE(MAX(score), 0)::int as "bestCompletion",
        COALESCE(MAX(duration_seconds), 0)::int as "longestSession",
        COUNT(*)::int as "totalSessions",
        COALESCE(ROUND(SUM(duration_seconds)::numeric / 60, 1), 0)::float as "totalMinutes"
      FROM activity_sessions
      WHERE user_id = $1 AND activity_type = $2;
    `;
    const { rows } = await pool.query(query, [userId, activityType]);
    return rows[0];
  }

  throw new Error(`Unsupported activity type: ${activityType}`);
}

/**
 * Get total activity count (for the garden)
 */
async function getTotalCompletedCount(userId) {
  const query = `
    SELECT COUNT(*)::int as count
    FROM activity_sessions
    WHERE user_id = $1 AND completed = true;
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows[0].count;
}

/**
 * Fetch all aggregates, feedback stats, distribution counts, and trend series.
 */
async function getOverallStatsData(userId) {
  // 1. Basic aggregates (completed count is for completed = true only)
  const aggQuery = `
    SELECT 
      COUNT(*)::int as "totalPlays",
      COUNT(CASE WHEN completed = true THEN 1 END)::int as "completedCount",
      COALESCE(SUM(duration_seconds), 0)::int as "totalDurationSeconds"
    FROM activity_sessions
    WHERE user_id = $1;
  `;
  const aggRes = await pool.query(aggQuery, [userId]);
  const aggregates = aggRes.rows[0];

  // 2. Most played activity
  const mpQuery = `
    SELECT activity_type as "activityType", COUNT(*)::int as count
    FROM activity_sessions
    WHERE user_id = $1
    GROUP BY activity_type
    ORDER BY count DESC
    LIMIT 1;
  `;
  const mpRes = await pool.query(mpQuery, [userId]);
  const mostPlayedActivity = mpRes.rows[0]?.activityType || null;

  // 3. Feedback ratings
  const fbQuery = `
    SELECT 
      COALESCE(ROUND(AVG(rating)::numeric, 1)::float, 0.0) as "averageRating",
      COUNT(*)::int as "ratingCount"
    FROM activity_feedback
    WHERE user_id = $1;
  `;
  const fbRes = await pool.query(fbQuery, [userId]);
  const feedback = fbRes.rows[0];
  
  // Set averageRating to null if there are no ratings
  if (feedback.ratingCount === 0) {
    feedback.averageRating = null;
  }

  // 4. Distribution by activity type
  const distQuery = `
    SELECT activity_type as "activityType", COUNT(*)::int as count
    FROM activity_sessions
    WHERE user_id = $1
    GROUP BY activity_type;
  `;
  const distRes = await pool.query(distQuery, [userId]);
  const distribution = distRes.rows;

  // Ensure all three game types are represented in distribution, even with 0 counts
  const gameTypes = ["pop_stress", "memory_match", "breathing_bubble"];
  const populatedDist = gameTypes.map(gt => {
    const existing = distribution.find(d => d.activityType === gt);
    return {
      activity_type: gt,
      count: existing ? existing.count : 0
    };
  });

  // 5. 7-Day Trend (completions)
  const trendQuery = `
    SELECT 
      TO_CHAR(d.day, 'YYYY-MM-DD') as date,
      COALESCE(COUNT(a.id), 0)::int as count
    FROM (
      SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval)::date as day
    ) d
    LEFT JOIN activity_sessions a 
      ON a.created_at::date = d.day AND a.user_id = $1 AND a.completed = true
    GROUP BY d.day
    ORDER BY d.day ASC;
  `;
  const trendRes = await pool.query(trendQuery, [userId]);

  // 6. Today's mindful time (completed = true only)
  const todayMindfulQuery = `
    SELECT COALESCE(SUM(duration_seconds), 0)::int as seconds
    FROM activity_sessions
    WHERE user_id = $1 AND completed = true AND created_at >= CURRENT_DATE;
  `;
  const todayMindfulRes = await pool.query(todayMindfulQuery, [userId]);
  const todayMindfulSeconds = todayMindfulRes.rows[0].seconds;

  // 7. This week's mindful time (starts Monday, completed = true only)
  const weekMindfulQuery = `
    SELECT COALESCE(SUM(duration_seconds), 0)::int as seconds
    FROM activity_sessions
    WHERE user_id = $1 AND completed = true AND created_at >= date_trunc('week', CURRENT_DATE);
  `;
  const weekMindfulRes = await pool.query(weekMindfulQuery, [userId]);
  const weekMindfulSeconds = weekMindfulRes.rows[0].seconds;

  // 8. Total mindful time (completed = true only)
  const totalMindfulQuery = `
    SELECT COALESCE(SUM(duration_seconds), 0)::int as seconds
    FROM activity_sessions
    WHERE user_id = $1 AND completed = true;
  `;
  const totalMindfulRes = await pool.query(totalMindfulQuery, [userId]);
  const totalMindfulSeconds = totalMindfulRes.rows[0].seconds;

  // 9. Duration by activity type (completed = true only)
  const catDurationQuery = `
    SELECT activity_type as "activityType", COALESCE(SUM(duration_seconds), 0)::int as seconds
    FROM activity_sessions
    WHERE user_id = $1 AND completed = true
    GROUP BY activity_type;
  `;
  const catDurationRes = await pool.query(catDurationQuery, [userId]);
  const catDurations = catDurationRes.rows;

  return {
    completedCount: aggregates.completedCount,
    totalPlays: aggregates.totalPlays,
    totalDurationSeconds: aggregates.totalDurationSeconds,
    mostPlayedActivity,
    feedback,
    distribution: populatedDist,
    trend: trendRes.rows,
    todayMindfulSeconds,
    weekMindfulSeconds,
    totalMindfulSeconds,
    catDurations
  };
}

/**
 * Fetch dedicated mindful wellness time aggregates and 7-day duration trend.
 */
async function getWellnessTimeData(userId) {
  // 1. Today's mindful time (completed = true only)
  const todayMindfulQuery = `
    SELECT COALESCE(SUM(duration_seconds), 0)::int as seconds
    FROM activity_sessions
    WHERE user_id = $1 AND completed = true AND created_at >= CURRENT_DATE;
  `;
  const todayMindfulRes = await pool.query(todayMindfulQuery, [userId]);
  const todayMindfulSeconds = todayMindfulRes.rows[0].seconds;

  // 2. This week's mindful time (starts Monday, completed = true only)
  const weekMindfulQuery = `
    SELECT COALESCE(SUM(duration_seconds), 0)::int as seconds
    FROM activity_sessions
    WHERE user_id = $1 AND completed = true AND created_at >= date_trunc('week', CURRENT_DATE);
  `;
  const weekMindfulRes = await pool.query(weekMindfulQuery, [userId]);
  const weekMindfulSeconds = weekMindfulRes.rows[0].seconds;

  // 3. Total mindful time (completed = true only)
  const totalMindfulQuery = `
    SELECT COALESCE(SUM(duration_seconds), 0)::int as seconds
    FROM activity_sessions
    WHERE user_id = $1 AND completed = true;
  `;
  const totalMindfulRes = await pool.query(totalMindfulQuery, [userId]);
  const totalMindfulSeconds = totalMindfulRes.rows[0].seconds;

  // 4. Most played activity
  const mpQuery = `
    SELECT activity_type as "activityType"
    FROM activity_sessions
    WHERE user_id = $1
    GROUP BY activity_type
    ORDER BY COUNT(*) DESC
    LIMIT 1;
  `;
  const mpRes = await pool.query(mpQuery, [userId]);
  const mostPlayedActivity = mpRes.rows[0]?.activityType || null;

  // 5. Durations by activity type (completed = true only)
  const catDurationQuery = `
    SELECT activity_type as "activityType", COALESCE(SUM(duration_seconds), 0)::int as seconds
    FROM activity_sessions
    WHERE user_id = $1 AND completed = true
    GROUP BY activity_type;
  `;
  const catDurationRes = await pool.query(catDurationQuery, [userId]);
  const catDurations = catDurationRes.rows;

  // 6. 7-Day Mindful Duration Trend (in seconds, completed = true only)
  const dailyTimeQuery = `
    SELECT 
      TO_CHAR(d.day, 'YYYY-MM-DD') as date,
      COALESCE(SUM(a.duration_seconds), 0)::int as seconds
    FROM (
      SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval)::date as day
    ) d
    LEFT JOIN activity_sessions a 
      ON a.created_at::date = d.day AND a.user_id = $1 AND a.completed = true
    GROUP BY d.day
    ORDER BY d.day ASC;
  `;
  const dailyTimeRes = await pool.query(dailyTimeQuery, [userId]);

  return {
    todayMindfulSeconds,
    weekMindfulSeconds,
    totalMindfulSeconds,
    mostPlayedActivity,
    catDurations,
    dailyTime: dailyTimeRes.rows
  };
}

module.exports = {
  createSession,
  createFeedback,
  getSessionHistory,
  getBestStats,
  getTotalCompletedCount,
  getOverallStatsData,
  getWellnessTimeData
};
