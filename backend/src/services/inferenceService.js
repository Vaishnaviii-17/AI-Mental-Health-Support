/**
 * inferenceService.js
 *
 * Responsible ONLY for communicating with the Python ML inference server
 * over HTTP. Does not load, train, or run any model itself -- Node never
 * touches PyTorch/HuggingFace directly.
 *
 * Python server:
 *   GET  /health
 *   POST /predict   body: { text }
 *
 * The Python server is the single source of truth for:
 *   - primary 6-class emotion (softmax)
 *   - GoEmotions multi-label emotions (sigmoid)
 *   - GoEmotions-derived sentiment (positive/negative/neutral)
 *   - engineering risk screening indicator (NOT a clinical/diagnostic score)
 */
const axios = require("axios");

// ML_INFERENCE_URL is the documented env var name. INFERENCE_SERVICE_URL
// is kept as a fallback alias for backward compatibility with an earlier
// draft of this service that used that name.
const ML_INFERENCE_URL =
  process.env.ML_INFERENCE_URL ||
  process.env.INFERENCE_SERVICE_URL ||
  "http://127.0.0.1:5001";

const INFERENCE_TIMEOUT_MS = Number(process.env.INFERENCE_TIMEOUT_MS) || 15000;
const HEALTH_TIMEOUT_MS = Number(process.env.INFERENCE_HEALTH_TIMEOUT_MS) || 5000;

/**
 * Send text to the Python ML inference server and return its parsed
 * response unchanged (emotion / sentiment / goemotions / risk).
 *
 * @param {string} text
 * @returns {Promise<object>}
 * @throws {TypeError} if text is not a string
 * @throws {Error} if text is empty, or the inference server is unreachable/errors
 */
async function analyzeText(text) {
  if (typeof text !== "string") {
    throw new TypeError("text must be a string");
  }

  const cleanedText = text.trim();

  if (!cleanedText) {
    throw new Error("text cannot be empty");
  }

  try {
    const res = await axios.post(
      `${ML_INFERENCE_URL}/predict`,
      { text: cleanedText },
      {
        headers: { "Content-Type": "application/json" },
        timeout: INFERENCE_TIMEOUT_MS,
      }
    );

    return res.data;
  } catch (error) {
    if (error.response) {
      // Python server responded with an error status (e.g. 400/500).
      console.error(
        "Inference server error:",
        error.response.status,
        error.response.data
      );
    } else if (error.request) {
      // Request was made but no response was received (server down /
      // unreachable / timed out).
      console.error("Inference server is unreachable:", ML_INFERENCE_URL);
    } else {
      console.error("Inference request error:", error.message);
    }

    // Intentionally generic: never leak Python stack traces, file paths,
    // or internal model paths to callers/API consumers.
    throw new Error("Mental health inference service unavailable");
  }
}

/**
 * Check whether the Python inference server is reachable and healthy.
 *
 * @returns {Promise<object>} the server's health payload
 * @throws {Error} if the server is unreachable
 */
async function healthCheck() {
  try {
    const res = await axios.get(`${ML_INFERENCE_URL}/health`, {
      timeout: HEALTH_TIMEOUT_MS,
    });
    return res.data;
  } catch (error) {
    console.error("Inference health check failed:", error.message);
    throw new Error("Mental health inference service unavailable");
  }
}

module.exports = {
  analyzeText,
  healthCheck,
};