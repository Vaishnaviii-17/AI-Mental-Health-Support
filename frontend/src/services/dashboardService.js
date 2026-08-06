import api from "../lib/axios";
import { MOCK_DASHBOARD_DATA } from "../components/dashboard/dashboardData";

const useMockData = import.meta.env.VITE_USE_MOCK_DASHBOARD !== "false";
const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
const getData = (response) => response.data?.data ?? response.data;

/**
 * Dashboard DTO adapter. The individual calls mirror the future REST contract:
 * /dashboard, /mood/latest, /mood/history, /journal/recent, /recommendation,
 * and /profile. Keep API field normalization here as the backend evolves.
 */
export async function getDashboardData() {
  if (useMockData) {
    await wait(500);
    return MOCK_DASHBOARD_DATA;
  }

  const [dashboard, latestMood, moodHistory, journals, recommendation, profile] = await Promise.all([
    api.get("/dashboard", authConfig()), api.get("/mood/latest", authConfig()),
    api.get("/mood/history", authConfig()), api.get("/journal/recent", authConfig()),
    api.get("/recommendation", authConfig()), api.get("/profile", authConfig()),
  ]);

  return { ...getData(dashboard), latestMood: getData(latestMood), moodHistory: getData(moodHistory), journals: getData(journals), recommendation: getData(recommendation), profile: getData(profile) };
}
