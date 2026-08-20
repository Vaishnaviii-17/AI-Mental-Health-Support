import api from "../lib/axios";

/**
 * Save a completed or ended activity session.
 * 
 * Data: { activity_type, score, duration_seconds, completed, metadata }
 */
export async function saveActivitySession(data) {
  const response = await api.post("/activities/sessions", data, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });
  return response.data?.data;
}

/**
 * Submit optional feedback rating (1–5) for an activity session.
 */
export async function submitActivityFeedback(activitySessionId, rating) {
  const response = await api.post(
    "/activities/feedback",
    {
      activity_session_id: activitySessionId,
      rating: Number(rating),
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
 * Fetch stats for a specific activity type.
 */
export async function getActivityStats(activityType) {
  const response = await api.get(`/activities/stats/${activityType}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });
  return response.data?.data;
}

/**
 * Fetch paginated activity history.
 */
export async function getActivityHistory(page = 1, limit = 20) {
  const response = await api.get(`/activities/history?page=${page}&limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });
  return response.data?.data;
}

/**
 * Fetch overall activity statistics.
 */
export async function getOverallStats() {
  const response = await api.get("/activities/overall-stats", {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });
  return response.data?.data;
}

/**
 * Fetch dedicated mindful time statistics for Analytics.
 */
export async function getWellnessTime() {
  const response = await api.get("/activities/wellness-time", {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });
  return response.data?.data;
}


