import api from "../lib/axios";

const authConfig = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

export const getChatHistory = async () => {
  const response = await api.get("/chat/history", authConfig());
  return response.data?.data ?? response.data;
};

export const sendMessage = async (message, sessionId) => {
  const response = await api.post("/chat/message", { message, sessionId }, authConfig());
  return response.data?.data ?? response.data;
};

export const transcribeChatAudio = async (audioBlob) => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "chat-audio.webm");

  const response = await api.post("/chat/transcribe", formData, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data?.data ?? response.data;
};

export const clearChat = async () => {
  const response = await api.delete("/chat/clear", authConfig());
  return response.data?.data ?? response.data;
};

export const deleteSession = async (sessionId) => {
  const response = await api.delete(`/chat/session/${sessionId}`, authConfig());
  return response.data?.data ?? response.data;
};
