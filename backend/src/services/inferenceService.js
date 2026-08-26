/**
 * inferenceService.js
 *
 * Responsible ONLY for communicating with the Python ML inference
 * server over HTTP.
 *
 * Node never loads or runs PyTorch/HuggingFace models directly.
 *
 * Python endpoints:
 *
 *   GET  /health
 *   POST /predict
 *   POST /chat
 *   POST /transcribe
 *
 * /predict
 *   Analysis only.
 *
 * /chat
 *   Analysis + conversational response generation.
 *
 * The Python /chat endpoint is responsible for:
 *
 *   - emotion
 *   - topic/analysis information
 *   - risk
 *   - response strategy
 *   - Hugging Face LLM response
 *   - fallback response
 */

const axios = require("axios");


/**
 * Python inference server URL.
 *
 * Preferred:
 *
 *   ML_INFERENCE_URL
 *
 * Backward-compatible:
 *
 *   INFERENCE_SERVICE_URL
 */
const ML_INFERENCE_URL =
  process.env.ML_INFERENCE_URL ||
  process.env.INFERENCE_SERVICE_URL ||
  "http://127.0.0.1:5001";


const INFERENCE_TIMEOUT_MS =
  Number(process.env.INFERENCE_TIMEOUT_MS) || 15000;


const CHAT_TIMEOUT_MS =
  Number(process.env.CHAT_INFERENCE_TIMEOUT_MS) || 60000;


const HEALTH_TIMEOUT_MS =
  Number(process.env.INFERENCE_HEALTH_TIMEOUT_MS) || 5000;


/**
 * Analyze a single piece of text.
 *
 * This calls Python /predict.
 *
 * @param {string} text
 * @returns {Promise<object>}
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
      {
        text: cleanedText,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: INFERENCE_TIMEOUT_MS,
      }
    );

    return res.data;

  } catch (error) {

    if (error.response) {

      console.error(
        "Inference server error:",
        error.response.status,
        error.response.data
      );

    } else if (error.request) {

      console.error(
        "Inference server is unreachable:",
        ML_INFERENCE_URL
      );

    } else {

      console.error(
        "Inference request error:",
        error.message
      );
    }

    throw new Error(
      "Mental health inference service unavailable"
    );
  }
}


/**
 * Generate a complete conversational response.
 *
 * This calls Python /chat.
 *
 * Python is responsible for:
 *
 *   analysis
 *   response generation
 *   Hugging Face
 *   fallback
 *
 * @param {string} message
 * @param {Array<object>} history
 * @returns {Promise<object>}
 */
async function generateChatResponse(
  message,
  history = []
) {

  if (typeof message !== "string") {
    throw new TypeError("message must be a string");
  }

  const cleanedMessage = message.trim();

  if (!cleanedMessage) {
    throw new Error("message cannot be empty");
  }

  const safeHistory =
    Array.isArray(history)
      ? history.slice(-15)
      : [];

  try {

    console.log(
      "Sending chat request to Python inference server..."
    );

    const res = await axios.post(
      `${ML_INFERENCE_URL}/chat`,
      {
        text: cleanedMessage,
        history: safeHistory,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: CHAT_TIMEOUT_MS,
      }
    );

    return res.data;

  } catch (error) {

    if (error.response) {

      console.error(
        "Chat inference server error:",
        error.response.status,
        error.response.data
      );

    } else if (error.request) {

      console.error(
        "Chat inference server is unreachable:",
        ML_INFERENCE_URL
      );

    } else {

      console.error(
        "Chat inference request error:",
        error.message
      );
    }

    throw new Error(
      "Mental health response service unavailable"
    );
  }
}


/**
 * Check whether the Python inference server is reachable.
 *
 * @returns {Promise<object>}
 */
async function healthCheck() {

  try {

    const res = await axios.get(
      `${ML_INFERENCE_URL}/health`,
      {
        timeout: HEALTH_TIMEOUT_MS,
      }
    );

    return res.data;

  } catch (error) {

    console.error(
      "Inference health check failed:",
      error.message
    );

    throw new Error(
      "Mental health inference service unavailable"
    );
  }
}


module.exports = {
  analyzeText,
  generateChatResponse,
  healthCheck,
};