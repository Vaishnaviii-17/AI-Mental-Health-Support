const axios = require("axios");
const {
  assertSupportedLanguage,
  DEFAULT_LANGUAGE,
} = require("../utils/language");

const TRANSLATION_PROVIDER = (
  process.env.TRANSLATION_PROVIDER || "auto"
).trim().toLowerCase();

const TRANSLATION_TIMEOUT_MS =
  Number(process.env.TRANSLATION_TIMEOUT_MS) || 20000;

const LIBRETRANSLATE_URL = (
  process.env.LIBRETRANSLATE_URL || ""
).trim().replace(/\/$/, "");

const TRANSLATION_API_KEY = (
  process.env.TRANSLATION_API_KEY || ""
).trim();

const GEMINI_API_KEY = (
  process.env.GEMINI_API_KEY || ""
).trim();

const GEMINI_TRANSLATION_MODEL =
  process.env.GEMINI_TRANSLATION_MODEL || "gemini-2.5-flash";

function hasUsableGeminiKey() {
  return Boolean(GEMINI_API_KEY && GEMINI_API_KEY !== "your_gemini_api_key");
}

function resolveProvider() {
  if (TRANSLATION_PROVIDER && TRANSLATION_PROVIDER !== "auto") {
    return TRANSLATION_PROVIDER;
  }

  if (LIBRETRANSLATE_URL) return "libretranslate";
  if (hasUsableGeminiKey()) return "gemini";

  return "disabled";
}

function createTranslationError(message, statusCode = 503) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function translateWithLibreTranslate(text, sourceLanguage) {
  if (!LIBRETRANSLATE_URL) {
    throw createTranslationError(
      "LibreTranslate URL is not configured. Set LIBRETRANSLATE_URL or choose another TRANSLATION_PROVIDER."
    );
  }

  const payload = {
    q: text,
    source: sourceLanguage,
    target: "en",
    format: "text",
  };

  if (TRANSLATION_API_KEY) {
    payload.api_key = TRANSLATION_API_KEY;
  }

  const res = await axios.post(
    `${LIBRETRANSLATE_URL}/translate`,
    payload,
    {
      headers: { "Content-Type": "application/json" },
      timeout: TRANSLATION_TIMEOUT_MS,
    }
  );

  const translatedText = res.data?.translatedText;

  if (!translatedText || !String(translatedText).trim()) {
    throw createTranslationError("Translation service returned an empty result.");
  }

  return String(translatedText).trim();
}

async function translateWithGemini(text, sourceLanguage) {
  if (!hasUsableGeminiKey()) {
    throw createTranslationError(
      "Gemini translation is not configured. Set GEMINI_API_KEY or choose another TRANSLATION_PROVIDER."
    );
  }

  const sourceName = sourceLanguage === "hi" ? "Hindi" : "Marathi";
  const prompt = [
    `Translate the following ${sourceName} journal entry to natural English.`,
    "Return only the translated English text. Do not add commentary.",
    "",
    text,
  ].join("\n");

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TRANSLATION_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await axios.post(
    url,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
      },
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: TRANSLATION_TIMEOUT_MS,
    }
  );

  const translatedText =
    res.data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!translatedText || !String(translatedText).trim()) {
    throw createTranslationError("Translation service returned an empty result.");
  }

  return String(translatedText).trim();
}

async function translateToEnglish(text, sourceLanguage = DEFAULT_LANGUAGE) {
  if (typeof text !== "string" || !text.trim()) {
    throw createTranslationError("Text is required for translation.", 400);
  }

  const normalizedLanguage = assertSupportedLanguage(sourceLanguage);
  const cleanedText = text.trim();

  if (normalizedLanguage === DEFAULT_LANGUAGE) {
    return {
      text: cleanedText,
      translatedText: null,
      sourceLanguage: normalizedLanguage,
      provider: "bypass",
    };
  }

  const provider = resolveProvider();

  if (provider === "disabled") {
    throw createTranslationError(
      "Translation is not configured. Set TRANSLATION_PROVIDER with a supported provider before saving Hindi or Marathi journals."
    );
  }

  try {
    const translatedText =
      provider === "libretranslate"
        ? await translateWithLibreTranslate(cleanedText, normalizedLanguage)
        : provider === "gemini"
          ? await translateWithGemini(cleanedText, normalizedLanguage)
          : null;

    if (!translatedText) {
      throw createTranslationError(
        `Unsupported translation provider: ${provider}`,
        400
      );
    }

    return {
      text: translatedText,
      translatedText,
      sourceLanguage: normalizedLanguage,
      provider,
    };
  } catch (error) {
    if (error.statusCode) throw error;

    if (error.response) {
      console.error(
        "Translation provider error:",
        error.response.status,
        error.response.data
      );
    } else {
      console.error("Translation failed:", error.message);
    }

    throw createTranslationError(
      "Unable to translate this journal entry for AI analysis. Please try again later."
    );
  }
}

module.exports = {
  translateToEnglish,
};
