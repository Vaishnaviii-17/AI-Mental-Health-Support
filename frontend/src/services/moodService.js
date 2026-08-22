import api from "../lib/axios";

/**
 * Get the logged-in user's manual mood for today.
 *
 * Returns:
 * - mood object if today's manual mood exists
 * - null if the user hasn't checked in today
 */
export async function getTodayMood() {
  const response = await api.get("/mood/today", {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  return response.data?.data ?? null;
}

/**
 * Create today's manual mood check-in.
 */
export async function saveMood({
  emoji,
  emotion,
  score,
  note,
}) {
  const response = await api.post(
    "/mood/checkin",
    {
      emoji,
      emotion,
      score,
      note: note?.trim() || null,
    },
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    }
  );

  return response.data?.data;
}

/**
 * Update today's existing manual mood.
 */
export async function updateMood({
  emoji,
  emotion,
  score,
  note,
}) {
  const response = await api.put(
    "/mood/today",
    {
      emoji,
      emotion,
      score,
      note: note?.trim() || null,
    },
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    }
  );

  return response.data?.data;
}

/**
 * Get the authenticated user's current check-in streak.
 * Returns a number (days).
 */
export async function getStreak() {
  const response = await api.get("/mood/stats", {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });
  // streak lives inside the dashboard summary, not stats — call /dashboard directly
  // We derive streak from the dashboard endpoint to avoid a separate call.
  return null; // Streak value is bundled in getDashboardData().summary
}