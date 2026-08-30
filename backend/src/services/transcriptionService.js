/**
 * Sends uploaded audio to the Python AI service for Whisper transcription.
 *
 * This stays separate from inferenceService.js so speech-to-text remains
 * independent from the existing GoEmotions text analysis pipeline.
 */
const axios = require("axios");
const FormData = require("form-data");
const { assertSupportedLanguage } = require("../utils/language");

const ML_INFERENCE_URL =
  process.env.ML_INFERENCE_URL ||
  process.env.INFERENCE_SERVICE_URL ||
  "http://127.0.0.1:5001";

const TRANSCRIPTION_TIMEOUT_MS =
  Number(process.env.TRANSCRIPTION_TIMEOUT_MS) || 60000;

async function transcribeAudio(file, language) {
  if (!file || !file.buffer || file.size <= 0) {
    throw new Error("audio file is required");
  }

  const transcriptionLanguage = assertSupportedLanguage(language);

  const form = new FormData();
  form.append("audio", file.buffer, {
    filename: file.originalname || "journal-audio.webm",
    contentType: file.mimetype || "audio/webm",
    knownLength: file.size,
  });
  form.append("language", transcriptionLanguage);

  try {
    const res = await axios.post(`${ML_INFERENCE_URL}/transcribe`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      timeout: TRANSCRIPTION_TIMEOUT_MS,
    });

    return {
      ...res.data,
      language: res.data?.language || transcriptionLanguage,
    };
  } catch (error) {
    if (error.response) {
      console.error("Transcription server error:", error.response.status);
      const message = error.response.data?.error || "Transcription failed";
      const err = new Error(message);
      err.statusCode = error.response.status;
      throw err;
    }

    if (error.request) {
      console.error("Transcription service is unreachable:", ML_INFERENCE_URL);
    } else {
      console.error("Transcription request error:", error.message);
    }

    const err = new Error("Speech transcription service is temporarily unavailable.");
    err.statusCode = 503;
    throw err;
  }
}

module.exports = {
  transcribeAudio,
};
