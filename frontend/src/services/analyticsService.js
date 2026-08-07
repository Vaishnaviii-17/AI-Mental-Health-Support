import api from "../lib/axios";

const authConfig = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

export const getMoodStats = async () => {
  const response = await api.get("/mood/stats", authConfig());
  return response.data?.data ?? response.data;
};

export const getMoodHistory = async () => {
  const response = await api.get("/mood/history", authConfig());
  return response.data?.data ?? response.data;
};

export const getActivityCalendar = async () => {
  const response = await api.get("/mood/activity", authConfig());
  return response.data?.data ?? response.data;
};
