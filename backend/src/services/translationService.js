const axios = require("axios");

const {
  assertSupportedLanguage,
  DEFAULT_LANGUAGE,
} = require("../utils/language");


// ============================================================
// CONFIGURATION
// ============================================================

// Python inference server.
// Your Flask /translate endpoint runs here.
const ML_INFERENCE_URL = (
  process.env.ML_INFERENCE_URL ||
  "http://127.0.0.1:5001"
)
  .trim()
  .replace(/\/$/, "");


// NLLB may take longer on the first request because the
// model is lazy-loaded into GPU memory.
const NLLB_TRANSLATION_TIMEOUT_MS =
  Number(process.env.NLLB_TRANSLATION_TIMEOUT_MS) ||
  120000;


// Gemini is fallback only.
const GEMINI_API_KEY = (
  process.env.GEMINI_API_KEY || ""
).trim();

const GEMINI_TRANSLATION_MODEL = (
  process.env.GEMINI_TRANSLATION_MODEL ||
  "gemini-3.8-flash"
).trim();

const GEMINI_TRANSLATION_TIMEOUT_MS =
  Number(process.env.TRANSLATION_TIMEOUT_MS) ||
  20000;


// ============================================================
// HELPERS
// ============================================================

function createTranslationError(
  message,
  statusCode = 503
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}


function hasUsableGeminiKey() {
  return Boolean(
    GEMINI_API_KEY &&
    GEMINI_API_KEY !== "your_gemini_api_key"
  );
}


// ============================================================
// PRIMARY PROVIDER: NLLB-200
// ============================================================

async function translateWithNLLB(
  text,
  sourceLanguage
) {
  const url =
    `${ML_INFERENCE_URL}/translate`;

  console.log("");
  console.log(
    "=============================================="
  );
  console.log(
    "[TRANSLATION] PRIMARY PROVIDER: NLLB-200"
  );
  console.log(
    `[TRANSLATION] Source language: ${sourceLanguage}`
  );
  console.log(
    `[TRANSLATION] Endpoint: ${url}`
  );
  console.log(
    "=============================================="
  );

  try {
    const response = await axios.post(
      url,
      {
        text,
        source_language: sourceLanguage,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: NLLB_TRANSLATION_TIMEOUT_MS,
      }
    );

    const translatedText =
      response.data?.translated_text ||
      response.data?.text;

    if (
      !translatedText ||
      !String(translatedText).trim()
    ) {
      throw new Error(
        "NLLB returned an empty translation."
      );
    }

    const cleanedTranslation =
      String(translatedText).trim();

    console.log(
      "[TRANSLATION] NLLB SUCCESS:",
      cleanedTranslation
    );

    console.log(
      "[TRANSLATION] Provider returned by Python:",
      response.data?.provider || "nllb-200"
    );

    return cleanedTranslation;

  } catch (error) {
    console.error(
      "[TRANSLATION] NLLB FAILED:",
      error.message
    );

    if (error.response) {
      console.error(
        "[TRANSLATION] NLLB HTTP status:",
        error.response.status
      );

      console.error(
        "[TRANSLATION] NLLB response:",
        error.response.data
      );
    }

    throw error;
  }
}


// ============================================================
// FALLBACK PROVIDER: GEMINI
// ============================================================

async function translateWithGemini(
  text,
  sourceLanguage
) {
  if (!hasUsableGeminiKey()) {
    throw new Error(
      "Gemini fallback is not configured."
    );
  }

  let sourceName;

  if (sourceLanguage === "hi") {
    sourceName = "Hindi";
  } else if (sourceLanguage === "mr") {
    sourceName = "Marathi";
  } else {
    sourceName = sourceLanguage;
  }

  const prompt = [
    `Translate the following ${sourceName} journal entry into natural English.`,
    "Preserve the original emotional meaning and intensity.",
    "Return only the English translation.",
    "Do not add explanations, labels, or commentary.",
    "",
    text,
  ].join("\n");

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    `${GEMINI_TRANSLATION_MODEL}:generateContent` +
    `?key=${GEMINI_API_KEY}`;

  console.log("");
  console.log(
    "=============================================="
  );
  console.log(
    "[TRANSLATION] FALLBACK PROVIDER: GEMINI"
  );
  console.log(
    `[TRANSLATION] Gemini model: ${GEMINI_TRANSLATION_MODEL}`
  );
  console.log(
    `[TRANSLATION] Source language: ${sourceLanguage}`
  );
  console.log(
    "=============================================="
  );

  try {
    const response = await axios.post(
      url,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout:
          GEMINI_TRANSLATION_TIMEOUT_MS,
      }
    );

    const translatedText =
      response.data?.candidates?.[0]
        ?.content?.parts?.[0]?.text;

    if (
      !translatedText ||
      !String(translatedText).trim()
    ) {
      throw new Error(
        "Gemini returned an empty translation."
      );
    }

    const cleanedTranslation =
      String(translatedText).trim();

    console.log(
      "[TRANSLATION] GEMINI FALLBACK SUCCESS:",
      cleanedTranslation
    );

    return cleanedTranslation;

  } catch (error) {
    console.error(
      "[TRANSLATION] GEMINI FALLBACK FAILED:",
      error.message
    );

    if (error.response) {
      console.error(
        "[TRANSLATION] Gemini HTTP status:",
        error.response.status
      );

      console.error(
        "[TRANSLATION] Gemini response:",
        error.response.data
      );
    }

    throw error;
  }
}


// ============================================================
// MAIN TRANSLATION FUNCTION
// ============================================================

async function translateToEnglish(
  text,
  sourceLanguage = DEFAULT_LANGUAGE
) {
  // ----------------------------------------------------------
  // Validate text
  // ----------------------------------------------------------

  if (
    typeof text !== "string" ||
    !text.trim()
  ) {
    throw createTranslationError(
      "Text is required for translation.",
      400
    );
  }

  const cleanedText =
    text.trim();

  // Use the project's existing language validation.
  const normalizedLanguage =
    assertSupportedLanguage(
      sourceLanguage
    );


  // ----------------------------------------------------------
  // ENGLISH → BYPASS
  // ----------------------------------------------------------

  if (
    normalizedLanguage ===
    DEFAULT_LANGUAGE
  ) {
    console.log(
      "[TRANSLATION] English input detected. Translation bypassed."
    );

    return {
      text: cleanedText,
      translatedText: null,
      sourceLanguage:
        normalizedLanguage,
      provider: "bypass",
    };
  }


  // ----------------------------------------------------------
  // PRIMARY → NLLB
  // ----------------------------------------------------------

  try {
    console.log(
      `[TRANSLATION] Trying NLLB first for ${normalizedLanguage}...`
    );

    const translatedText =
      await translateWithNLLB(
        cleanedText,
        normalizedLanguage
      );

    console.log(
      "[TRANSLATION] Primary NLLB translation completed successfully."
    );

    return {
      text: translatedText,
      translatedText,
      sourceLanguage:
        normalizedLanguage,
      provider: "nllb-200",
    };

  } catch (nllbError) {
    console.warn(
      "[TRANSLATION] Primary NLLB translation failed."
    );

    console.warn(
      `[TRANSLATION] NLLB reason: ${nllbError.message}`
    );

    console.warn(
      "[TRANSLATION] Attempting Gemini fallback..."
    );
  }


  // ----------------------------------------------------------
  // FALLBACK → GEMINI
  // ----------------------------------------------------------

  try {
    const translatedText =
      await translateWithGemini(
        cleanedText,
        normalizedLanguage
      );

    console.log(
      "[TRANSLATION] Gemini fallback completed successfully."
    );

    return {
      text: translatedText,
      translatedText,
      sourceLanguage:
        normalizedLanguage,
      provider: "gemini-fallback",
    };

  } catch (geminiError) {
    console.error(
      "[TRANSLATION] Both NLLB and Gemini translation failed."
    );

    console.error(
      `[TRANSLATION] Gemini fallback reason: ${geminiError.message}`
    );

    throw createTranslationError(
      "Unable to translate this journal entry for AI analysis. Please try again later.",
      503
    );
  }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  translateToEnglish,
};