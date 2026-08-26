const chatModel = require("../models/chatModel");
const inferenceService = require("../services/inferenceService");
const { resolveEmotion, sentimentToScore } = require("../utils/mlMapping");
const response = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");


/**
 * Fetch chat history for the current user
 */
const getChatHistory = asyncHandler(async (req, res) => {

  const history = await chatModel.getChatHistory(
    req.user.id
  );

  res.status(200).json(
    response.success(
      "Chat history retrieved successfully",
      history
    )
  );
});


/**
 * Send a message to the AI and receive an empathetic response.
 *
 * Flow:
 *
 * React
 *   ↓
 * Node
 *   ↓
 * Python /chat
 *   ↓
 * MentalHealthPredictor
 *   ↓
 * ResponseGenerator
 *   ↓
 * Hugging Face
 *   ↓
 * fallback if necessary
 *   ↓
 * Node
 *   ↓
 * React
 */
const sendMessage = asyncHandler(async (req, res) => {

  const {
    message,
    sessionId,
  } = req.body;


  // ==========================================================
  // VALIDATE MESSAGE
  // ==========================================================

  if (
    !message ||
    typeof message !== "string" ||
    !message.trim()
  ) {

    return res.status(400).json(
      response.error(
        "Message content is required"
      )
    );
  }


  const cleanedMessage = message.trim();


  // ==========================================================
  // 1. GET CURRENT USER'S CHAT HISTORY
  // ==========================================================

  const fullHistory =
    await chatModel.getChatHistory(
      req.user.id
    );


  // Only use the current session as context when a
  // session ID exists.
  const sessionHistory = sessionId
    ? fullHistory.filter(
        (m) => m.session_id === sessionId
      )
    : fullHistory;


  // Keep the context reasonably small.
  const contextHistory =
    sessionHistory.slice(-15);


  // ==========================================================
  // 2. ASK PYTHON FOR COMPLETE CHAT RESPONSE
  // ==========================================================

  let aiResponse;

  try {

    aiResponse =
      await inferenceService.generateChatResponse(
        cleanedMessage,
        contextHistory
      );

  } catch (err) {

    console.error(
      "AI chat response generation failed:",
      err.message
    );

    return res.status(503).json(
      response.error(
        "AI response service is currently unavailable"
      )
    );
  }


  // ==========================================================
  // 3. EXTRACT RESPONSE
  // ==========================================================

  const aiText =
    aiResponse?.text ||
    aiResponse?.message;


  if (
    !aiText ||
    typeof aiText !== "string"
  ) {

    console.error(
      "Python chat response did not contain text:",
      aiResponse
    );

    return res.status(502).json(
      response.error(
        "AI response was invalid"
      )
    );
  }


  const isCrisis =
    Boolean(
      aiResponse?.isCrisis
    );


  // ==========================================================
  // 4. ANALYZE USER MESSAGE FOR DATABASE STORAGE
  // ==========================================================
  //
  // We keep this separate from /chat so the existing database
  // emotion/score behavior remains unchanged.
  //
  // This means your existing PostgreSQL chat records continue
  // receiving:
  //
  //   emotion
  //   score
  //
  // exactly as before.
  //

  let userEmotion = null;
  let userScore = null;

  try {

    const analysis =
      aiResponse?.analysis ||
      await inferenceService.analyzeText(
        cleanedMessage
      );


    const resolvedEmotion =
      resolveEmotion(analysis);


    userEmotion =
      resolvedEmotion?.emotion ||
      "neutral";


    userScore =
      sentimentToScore(
        analysis?.sentiment?.scores
      ) || 3;

  } catch (err) {

    console.error(
      "Chat message emotion analysis failed:",
      err.message
    );

    userEmotion = "neutral";
    userScore = 3;
  }


  // ==========================================================
  // 5. SAVE USER MESSAGE
  // ==========================================================

  const savedUserMsg =
    await chatModel.addMessage(
      req.user.id,
      {
        sender: "user",
        message: cleanedMessage,
        isCrisis: false,
        sessionId: sessionId || null,
        emotion: userEmotion,
        score: userScore,
      }
    );


  // Use the actual database session ID so the AI message
  // belongs to the exact same conversation.
  const activeSessionId =
    savedUserMsg.session_id;


  // ==========================================================
  // 6. SAVE AI MESSAGE
  // ==========================================================

  const savedAiMsg =
    await chatModel.addMessage(
      req.user.id,
      {
        sender: "ai",
        message: aiText,
        isCrisis,
        sessionId: activeSessionId,
      }
    );


  // ==========================================================
  // 7. RETURN RESPONSE TO FRONTEND
  // ==========================================================

  res.status(200).json(
    response.success(
      "Message processed successfully",
      {
        id: savedAiMsg.id,

        sender: "ai",

        message: aiText,

        isCrisis,

        sessionId: activeSessionId,

        created_at:
          savedAiMsg.created_at,
      }
    )
  );
});


/**
 * Clear the current user's chat history
 */
const clearChat = asyncHandler(async (req, res) => {

  await chatModel.clearChat(
    req.user.id
  );

  res.status(200).json(
    response.success(
      "Chat history cleared successfully"
    )
  );
});


/**
 * Delete a specific chat session for the current user
 */
const deleteChatSession = asyncHandler(async (req, res) => {

  const {
    sessionId,
  } = req.params;


  if (!sessionId) {

    return res.status(400).json(
      response.error(
        "Session ID is required"
      )
    );
  }


  await chatModel.deleteSession(
    req.user.id,
    sessionId
  );


  res.status(200).json(
    response.success(
      "Chat session deleted successfully"
    )
  );
});


module.exports = {
  getChatHistory,
  sendMessage,
  clearChat,
  deleteChatSession,
};