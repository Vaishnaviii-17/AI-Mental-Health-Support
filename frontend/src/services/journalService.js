import api from "../lib/axios";

const authConfig = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

export const getJournals = async () => {
  const response = await api.get("/journal", authConfig());
  return response.data?.data ?? response.data;
};

export const getJournalById = async (id) => {
  const response = await api.get(`/journal/${id}`, authConfig());
  return response.data?.data ?? response.data;
};

export const createJournal = async (journalData) => {
  const response = await api.post("/journal", journalData, authConfig());
  return response.data?.data ?? response.data;
};

export const transcribeJournalAudio = async (audioBlob, language = "en") => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "journal-audio.webm");
  formData.append("language", language);

  const response = await api.post("/journal/transcribe", formData, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data?.data ?? response.data;
};

export const deleteJournal = async (id) => {
  const response = await api.delete(`/journal/${id}`, authConfig());
  return response.data?.data ?? response.data;
};
