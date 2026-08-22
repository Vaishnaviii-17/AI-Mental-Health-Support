const pool = require("../config/db");
const combinedMoodService = require("../services/combinedMoodService");
const { emotionToEmoji } = require("../utils/mlMapping");

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
 * Get all today's moods for a user.
 */
async function getTodayMoods(userId) {
  const query = `
    SELECT *
    FROM moods
    WHERE user_id = $1
      AND mood_date = CURRENT_DATE
    ORDER BY created_at ASC;
  `;

  const { rows } = await pool.query(query, [userId]);
  return rows;
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
 * Fetch mood history for a user across manual check-ins, journals, and chats.
 */
async function getMoodHistory(userId) {
  const query = `
    SELECT
      id::text,
      emoji AS mood,
      emotion,
      score,
      insight,
      note,
      source,
      created_at AS "date"
    FROM moods
    WHERE user_id = $1

    UNION ALL

    SELECT
      id::text,
      mood AS mood,
      emotion,
      sentiment_score AS score,
      insight,
      NULL AS note,
      'journal' AS source,
      created_at AS "date"
    FROM journals
    WHERE user_id = $1

    UNION ALL

    SELECT
      id::text,
      NULL AS mood,
      emotion,
      score,
      NULL AS insight,
      NULL AS note,
      'chat' AS source,
      created_at AS "date"
    FROM chats
    WHERE user_id = $1 AND sender = 'user' AND emotion IS NOT NULL

    ORDER BY "date" DESC;
  `;

  const { rows } = await pool.query(query, [userId]);

  function formatEmotionLabel(label) {
    if (!label) return "Neutral";
    const clean = label.trim();
    if (clean.toLowerCase() === "neutral") return "Neutral";
    return clean.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  }

  return rows.map(row => {
    row.emotion = formatEmotionLabel(row.emotion);
    if (!row.mood && row.emotion) {
      row.mood = emotionToEmoji(row.emotion.toLowerCase());
    }
    return row;
  });
}

/**
 * Calculate aggregate mood analytics for a user based on daily combined mood scores and activities.
 */
async function getMoodStats(userId) {
  // Title case helper for emotions
  function formatEmotionLabel(label) {
    if (!label) return "Neutral";
    const clean = label.trim();
    if (clean.toLowerCase() === "neutral") return "Neutral";
    return clean.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  }

  // 1. Fetch all distinct active dates across moods, journals, and chats
  const activeDatesRes = await pool.query(
    `
      SELECT DISTINCT date_str FROM (
        SELECT mood_date::text AS date_str FROM moods WHERE user_id = $1
        UNION
        SELECT created_at::date::text AS date_str FROM journals WHERE user_id = $1
        UNION
        SELECT created_at::date::text AS date_str FROM chats WHERE user_id = $1 AND sender = 'user' AND emotion IS NOT NULL
      ) active_days
      ORDER BY date_str ASC;
    `,
    [userId]
  );

  const activeDates = activeDatesRes.rows.map(r => r.date_str);

  // 2. Fetch daily combined mood scores for all active dates
  const dailyCombinedMoods = [];
  for (const dateStr of activeDates) {
    const combined = await combinedMoodService.getCombinedMoodForDate(userId, dateStr);
    if (combined) {
      dailyCombinedMoods.push({
        dateStr,
        score: combined.score,
        emotion: combined.emotion
      });
    }
  }

  // Calculate Average Mood Score
  let avgScore = 0;
  if (dailyCombinedMoods.length > 0) {
    const sum = dailyCombinedMoods.reduce((acc, m) => acc + m.score, 0);
    avgScore = Math.round((sum / dailyCombinedMoods.length) * 10) / 10;
  }

  // 3. Get most common emotion from all raw activities across the three tables
  const commonRes = await pool.query(
    `
      SELECT emotion, COUNT(*)::int AS cnt
      FROM (
        SELECT emotion FROM moods WHERE user_id = $1 AND emotion IS NOT NULL
        UNION ALL
        SELECT emotion FROM journals WHERE user_id = $1 AND emotion IS NOT NULL
        UNION ALL
        SELECT emotion FROM chats WHERE user_id = $1 AND sender = 'user' AND emotion IS NOT NULL
      ) all_emotions
      GROUP BY emotion
      ORDER BY cnt DESC, emotion ASC
      LIMIT 1;
    `,
    [userId]
  );

  const mostCommon = commonRes.rows[0]?.emotion
    ? formatEmotionLabel(commonRes.rows[0].emotion)
    : "Neutral";

  // 4. Total manual mood check-ins
  const countRes = await pool.query(
    `
      SELECT COUNT(*)::int AS total_count
      FROM moods
      WHERE user_id = $1 AND source = 'manual'
    `,
    [userId]
  );

  const checkinsCount = countRes.rows[0]?.total_count || 0;

  // 5. Last 7 calendar days' combined scores (including today)
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyScores = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    // Get local date string YYYY-MM-DD
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    const dateStr = localDate.toISOString().split('T')[0];

    const label = i === 0 ? "Today" : daysOfWeek[d.getDay()];

    const dayCombined = await combinedMoodService.getCombinedMoodForDate(userId, dateStr);
    if (dayCombined) {
      weeklyScores.push({ label, score: dayCombined.score });
    } else {
      weeklyScores.push({ label }); // Omit score key completely
    }
  }

  // 6. Emotion distribution from all raw activities
  const distRes = await pool.query(
    `
      SELECT emotion, COUNT(*)::int AS count
      FROM (
        SELECT emotion FROM moods WHERE user_id = $1 AND emotion IS NOT NULL
        UNION ALL
        SELECT emotion FROM journals WHERE user_id = $1 AND emotion IS NOT NULL
        UNION ALL
        SELECT emotion FROM chats WHERE user_id = $1 AND sender = 'user' AND emotion IS NOT NULL
      ) all_emotions
      GROUP BY emotion;
    `,
    [userId]
  );

  const emotionDistribution = {};
  distRes.rows.forEach((row) => {
    const key = formatEmotionLabel(row.emotion);
    emotionDistribution[key] = (emotionDistribution[key] || 0) + row.count;
  });

  // 7. Wellness Trend
  let trend = "Stable";
  if (dailyCombinedMoods.length >= 2) {
    const scores = dailyCombinedMoods.map(m => m.score);
    const mid = Math.floor(scores.length / 2);
    const firstHalf = scores.slice(0, mid);
    const secondHalf = scores.slice(mid);

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;

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
 * Get daily activity counts for the last 12 months
 * Aggregates journal entries + mood check-ins + chat messages per calendar day
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

/**
 * Calculate the user's daily check-in streak dynamically.
 */
async function getStreak(userId) {
  const query = `
    SELECT DISTINCT mood_date::text AS mood_date
    FROM moods
    WHERE user_id = $1 AND source = 'manual'
    ORDER BY mood_date::text DESC;
  `;
  const { rows } = await pool.query(query, [userId]);
  const dateStrings = rows.map(r => r.mood_date);

  if (dateStrings.length === 0) {
    return 0;
  }

  const getLocalDateString = (date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  const todayStr = getLocalDateString(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  let currentStreak = 0;
  let checkDateStr = todayStr;

  if (dateStrings.includes(todayStr)) {
    currentStreak = 1;
    checkDateStr = todayStr;
  } else if (dateStrings.includes(yesterdayStr)) {
    currentStreak = 1;
    checkDateStr = yesterdayStr;
  } else {
    return 0;
  }

  const nextDate = new Date(checkDateStr);
  while (true) {
    nextDate.setDate(nextDate.getDate() - 1);
    const nextDateStr = getLocalDateString(nextDate);
    if (dateStrings.includes(nextDateStr)) {
      currentStreak++;
    } else {
      break;
    }
  }

  return currentStreak;
}

module.exports = {
  createMood,
  getTodayMood,
  getTodayMoods,
  createDailyMood,
  updateTodayMood,
  getMoodHistory,
  getMoodStats,
  getActivityCalendar,
  getStreak,
};