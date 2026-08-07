import api from "../lib/axios";

const authConfig = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

export const getProfile = async () => {
  const response = await api.get("/user/profile", authConfig());
  return response.data?.data ?? response.data;
};

export const updateProfile = async (profileData) => {
  const response = await api.put("/user/profile", profileData, authConfig());
  return response.data?.data ?? response.data;
};

export const changePassword = async (passwordData) => {
  const response = await api.put("/user/password", passwordData, authConfig());
  return response.data?.data ?? response.data;
};

export const deleteAccount = async () => {
  const response = await api.delete("/user/account", authConfig());
  return response.data?.data ?? response.data;
};
