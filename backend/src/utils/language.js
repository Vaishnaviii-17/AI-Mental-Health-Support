const SUPPORTED_LANGUAGES = {
  en: { code: "en", name: "English", toggleLabel: "ENG" },
  hi: { code: "hi", name: "Hindi", toggleLabel: "HIN" },
  mr: { code: "mr", name: "Marathi", toggleLabel: "MAR" },
};

const SUPPORTED_LANGUAGE_CODES = Object.keys(SUPPORTED_LANGUAGES);
const DEFAULT_LANGUAGE = "en";

function normalizeLanguage(language, fallback = DEFAULT_LANGUAGE) {
  const normalized = String(language || fallback).trim().toLowerCase();
  return SUPPORTED_LANGUAGES[normalized] ? normalized : null;
}

function assertSupportedLanguage(language, fallback = DEFAULT_LANGUAGE) {
  const normalized = normalizeLanguage(language, fallback);

  if (!normalized) {
    const err = new Error(
      `Unsupported language. Supported languages are: ${SUPPORTED_LANGUAGE_CODES.join(", ")}.`
    );
    err.statusCode = 400;
    throw err;
  }

  return normalized;
}

function detectLanguageFromText(text) {
  const value = String(text || "");

  if (/[\u0900-\u097F]/.test(value)) {
    return "hi";
  }

  return DEFAULT_LANGUAGE;
}

module.exports = {
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  DEFAULT_LANGUAGE,
  normalizeLanguage,
  assertSupportedLanguage,
  detectLanguageFromText,
};
