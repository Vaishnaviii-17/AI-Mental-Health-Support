const pool = require("../config/db");
const moodModel = require("../models/moodModel");
const combinedMoodService = require("../services/combinedMoodService");
const response = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");

const WELLNESS_QUOTES = [
  {
    text: "Almost everything will work again if you unplug it for a few minutes, including you.",
    author: "Anne Lamott"
  },
  {
    text: "Quiet the mind and the soul will speak.",
    author: "Ma Jaya Sati Bhagavati"
  },
  {
    text: "Caring for myself is not self-indulgence, it is self-preservation.",
    author: "Audre Lorde"
  },
  {
    text: "Slow down and enjoy life. It's not only the scenery you miss by going too fast.",
    author: "Eddie Cantor"
  }
];

const getDashboardData = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // 1. Get today's local date string
  const getLocalDateString = (date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };
  const todayStr = getLocalDateString(new Date());

  // 2. Fetch counts
  // Total Mood Check-ins
  const checkinsCountRes = await pool.query(
    "SELECT COUNT(*)::int AS count FROM moods WHERE user_id = $1 AND source = 'manual'",
    [userId]
  );
  const moodCheckins = checkinsCountRes.rows[0]?.count || 0;

  // Total Journal Entries
  const journalCountRes = await pool.query(
    "SELECT COUNT(*)::int AS count FROM journals WHERE user_id = $1",
    [userId]
  );
  const journalEntries = journalCountRes.rows[0]?.count || 0;

  // Total AI Sessions
  const aiSessionsRes = await pool.query(
    "SELECT COUNT(DISTINCT session_id)::int AS count FROM chats WHERE user_id = $1",
    [userId]
  );
  const aiSessions = aiSessionsRes.rows[0]?.count || 0;

  // Streak
  const dayStreak = await moodModel.getStreak(userId);

  // Summary array matching the UI DTO structure
  const summary = [
    {
      icon: "mood",
      value: moodCheckins,
      label: "Mood Check-ins",
      detail: "All Time"
    },
    {
      icon: "journal",
      value: journalEntries,
      label: "Journal Entries",
      detail: "All Time"
    },
    {
      icon: "chat",
      value: aiSessions,
      label: "AI Sessions",
      detail: "All Time"
    },
    {
      icon: "streak",
      value: dayStreak,
      label: "Day Streak",
      detail: dayStreak > 0 ? "Keep going!" : "Start a habit today!"
    }
  ];

  // 3. Select a quote based on today's day of month
  const dayOfMonth = new Date().getDate();
  const quote = WELLNESS_QUOTES[dayOfMonth % WELLNESS_QUOTES.length];

  // 4. Fetch today's combined mood
  const todayCombinedMood = await combinedMoodService.getCombinedMoodForDate(userId, todayStr);

  res.status(200).json(
    response.success("Dashboard data retrieved successfully", {
      summary,
      quote,
      todayCombinedMood
    })
  );
});

module.exports = {
  getDashboardData
};
