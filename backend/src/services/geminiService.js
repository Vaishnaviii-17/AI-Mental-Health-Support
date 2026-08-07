const pool = require("../config/db");

// ──────────────────────────────────────────────────────────────────────────────
// INDIA-SPECIFIC CRISIS RESPONSE TEXT
// This is used by both the local fallback and as the template for Gemini.
// ──────────────────────────────────────────────────────────────────────────────
const INDIA_CRISIS_RESPONSE = `I hear that you're going through a very difficult moment, and I'm truly glad you're here. I'm an AI and I'm not able to provide crisis support, but you do not have to face this alone.

Please consider reaching out to someone you trust or a professional who can support you right now.

Indian mental health helplines available 24/7:
• Tele-MANAS: 14416 or 1-800-891-4416 (free, government helpline)
• iCall: 9152987821 (Mon–Sat, 8 AM–10 PM)
• Vandrevala Foundation: 1860-2662-345
• AASRA: 9820466627

If you are in immediate danger, please contact emergency services at 112 or go to your nearest emergency department.

You matter, and support is available.`;

// Crisis detection keywords
const CRISIS_KEYWORDS = [
  "suicide", "suicidal", "kill myself", "want to die", "hurt myself",
  "end my life", "self harm", "cutting myself", "better off dead",
  "overdose", "hanging myself", "slitting", "jumping off",
  "don't want to live", "not want to be alive", "harm myself"
];

// ──────────────────────────────────────────────────────────────────────────────
// LOCAL FALLBACK — Journal sentiment analysis
// ──────────────────────────────────────────────────────────────────────────────
function localAnalyzeJournal(content) {
  const text = content.toLowerCase();
  let emotion = "Neutral";
  let emoji = "😐";
  let score = 3;
  let insight = "Thank you for sharing your thoughts. Keeping a journal is a positive step for your wellbeing.";

  if (text.includes("happy") || text.includes("glad") || text.includes("excite") || text.includes("great") || text.includes("wonderful")) {
    emotion = "Happy"; emoji = "😊"; score = 5;
    insight = "It's wonderful to hear that you are experiencing moments of joy today. Cherish these positive feelings.";
  } else if (text.includes("calm") || text.includes("peace") || text.includes("serene") || text.includes("rest")) {
    emotion = "Calm"; emoji = "😌"; score = 5;
    insight = "You seem to be in a peaceful state of mind. This stillness is a perfect place to rest and recharge.";
  } else if (text.includes("relax") || text.includes("chill") || text.includes("comfy")) {
    emotion = "Relaxed"; emoji = "🌤️"; score = 4;
    insight = "It sounds like you are letting go of tension. Giving yourself permission to relax is essential.";
  } else if (text.includes("sad") || text.includes("cry") || text.includes("lonely") || text.includes("grief") || text.includes("hurt")) {
    emotion = "Sadness"; emoji = "😢"; score = 2;
    insight = "I feel your sadness through your words. It is completely okay to feel this way — allow yourself the space to feel.";
  } else if (text.includes("anxious") || text.includes("worry") || text.includes("scared") || text.includes("fear") || text.includes("panic")) {
    emotion = "Anxiety"; emoji = "😰"; score = 2;
    insight = "Your writing reflects anxious feelings. Take a slow breath, focusing on the present moment; you are safe.";
  } else if (text.includes("stress") || text.includes("tire") || text.includes("exhaust") || text.includes("busy") || text.includes("overwhelm")) {
    emotion = "Stress"; emoji = "😫"; score = 2;
    insight = "You sound quite overwhelmed and under pressure. Remember to take small, gentle breaks when you can.";
  } else if (text.includes("angry") || text.includes("mad") || text.includes("hate") || text.includes("annoy") || text.includes("pissed")) {
    emotion = "Anger"; emoji = "😠"; score = 2;
    insight = "There is frustration or anger in your thoughts. Channeling anger into writing is a healthy way to release it.";
  }

  return { emotion, emoji, sentimentScore: score, insight };
}

// ──────────────────────────────────────────────────────────────────────────────
// LOCAL FALLBACK — Chat responses (India-specific crisis text)
// ──────────────────────────────────────────────────────────────────────────────
function localChatResponse(history, message) {
  const text = message.toLowerCase();
  const isCrisis = CRISIS_KEYWORDS.some(keyword => text.includes(keyword));

  if (isCrisis) {
    return {
      text: INDIA_CRISIS_RESPONSE,
      isCrisis: true
    };
  }

  let responseText = "Thank you for reaching out. I'm here to listen. Could you tell me a bit more about how you're feeling?";
  if (text.includes("hello") || text.includes("hi")) {
    responseText = "Hi! I'm here to listen and walk alongside you. How are you feeling today?";
  } else if (text.includes("sad") || text.includes("lonely") || text.includes("depressed")) {
    responseText = "It sounds like you're carrying a heavy heart right now. I'm here if you want to talk it through. What's contributing to this feeling?";
  } else if (text.includes("anxious") || text.includes("worry") || text.includes("panic")) {
    responseText = "Anxiety can feel so overwhelming. Try taking a deep, slow breath with me. What is on your mind right now?";
  } else if (text.includes("stress") || text.includes("overwhelm")) {
    responseText = "It sounds like there is a lot on your plate. Remember that you don't have to figure it all out at once. What's one small thing we can focus on?";
  } else if (text.includes("thank")) {
    responseText = "You are very welcome. I'm glad I can be a quiet space for you.";
  }

  return { text: responseText, isCrisis: false };
}

// ──────────────────────────────────────────────────────────────────────────────
// JSON parse helper
// ──────────────────────────────────────────────────────────────────────────────
function cleanAndParseJSON(rawText) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");
  if (startIdx !== -1 && endIdx !== -1) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }
  return JSON.parse(cleaned);
}

// ──────────────────────────────────────────────────────────────────────────────
// Gemini 1.5 Flash API call
// ──────────────────────────────────────────────────────────────────────────────
async function callGeminiAPI(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key") {
    throw new Error("Gemini API key is not configured.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gemini API returned status ${response.status}`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) {
    throw new Error("Empty response from Gemini model.");
  }
  return textResponse;
}

// ──────────────────────────────────────────────────────────────────────────────
// Journal sentiment analysis
// ──────────────────────────────────────────────────────────────────────────────
async function analyzeJournal(content) {
  const prompt = `
You are an expert sentiment and emotion analyzer helper for a mental wellness application called MindEase, used by people in India.
Analyze the sentiment of the following private journal entry written by a user.
Detect:
1. 'emotion': Must be exactly one of: Happy, Calm, Relaxed, Content, Sad, Angry, Anxious, Neutral
2. 'emoji': A single appropriate emoji representing the emotion.
3. 'score': An integer score from 1 (lowest, highly distressed) to 5 (highest, very happy/serene).
4. 'insight': A short, supportive, validating reflection (1-2 sentences). Do NOT make any medical diagnosis or claim the user has a mental illness. Offer gentle encouragement.

Return ONLY a raw JSON object — no markdown formatting:
{
  "emotion": "Calm",
  "emoji": "😌",
  "score": 5,
  "insight": "Your writing reflects a deep sense of peaceful reflection. Taking slow moments like this is wonderful for your mental space."
}

Journal Entry:
"${content}"
`;

  try {
    const rawResponse = await callGeminiAPI(prompt);
    const parsed = cleanAndParseJSON(rawResponse);
    return {
      emotion: parsed.emotion || "Neutral",
      emoji: parsed.emoji || "😐",
      sentimentScore: Number(parsed.score) || 3,
      insight: parsed.insight || "Your entry has been saved securely."
    };
  } catch (error) {
    console.warn("⚠️ Gemini sentiment analysis failed, using local fallback:", error.message);
    return localAnalyzeJournal(content);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Chat response generation — India-specific crisis template
// ──────────────────────────────────────────────────────────────────────────────
async function generateChatResponse(history, newMessage) {
  // Crisis check runs locally first — instantaneous, cannot be blocked by API latency
  const isCrisisLocal = CRISIS_KEYWORDS.some(k => newMessage.toLowerCase().includes(k));
  if (isCrisisLocal) {
    return { text: INDIA_CRISIS_RESPONSE, isCrisis: true };
  }

  const formattedHistory = history
    .map(h => `${h.sender === "user" ? "User" : "MindEase AI"}: ${h.message}`)
    .join("\n");

  const prompt = `
You are MindEase, a gentle, empathetic, non-judgmental AI mental health companion designed for users in India.
Your purpose is to listen, validate feelings, and walk alongside the user. You are NOT a doctor or therapist.
You must never diagnose, label, or claim the user has a mental health disorder.

Rules:
- Be supportive, concise, and conversational.
- If the user shows ANY signs of self-harm, suicidal thoughts, or severe crisis, you MUST set isCrisis to true.
- When isCrisis is true, respond with India-specific support resources (Tele-MANAS: 14416, iCall: 9152987821, emergency: 112).
- Never mention US hotlines (988, 741741, 911) or any US-specific crisis resources.
- Keep responses brief (1–3 sentences for normal conversation).
- Do not make medical diagnoses or mention disorders.

Return ONLY a raw JSON object — no markdown:
{
  "text": "Your empathetic response here.",
  "isCrisis": false
}

If the user expresses crisis/self-harm, return:
{
  "text": "I hear that you're going through a very difficult moment. Please know you are not alone. In India, you can reach Tele-MANAS at 14416 (free, 24/7) or iCall at 9152987821. If you are in immediate danger, please contact emergency services at 112.",
  "isCrisis": true
}

Conversation History:
${formattedHistory}

New message from user:
"${newMessage}"
`;

  try {
    const rawResponse = await callGeminiAPI(prompt);
    const parsed = cleanAndParseJSON(rawResponse);

    // Safety net: if Gemini flags crisis, return our standardised India response
    if (parsed.isCrisis) {
      return { text: INDIA_CRISIS_RESPONSE, isCrisis: true };
    }

    return {
      text: parsed.text || "I'm here to listen. Tell me more.",
      isCrisis: false
    };
  } catch (error) {
    console.warn("⚠️ Gemini chat generation failed, using local fallback:", error.message);
    return localChatResponse(history, newMessage);
  }
}

module.exports = {
  analyzeJournal,
  generateChatResponse
};
