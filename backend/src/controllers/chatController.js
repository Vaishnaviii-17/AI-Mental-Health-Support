const chatModel = require("../models/chatModel");
const geminiService = require("../services/geminiService");
const response = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Fetch chat history for the current user
 */
const getChatHistory = asyncHandler(async (req, res) => {
  const history = await chatModel.getChatHistory(req.user.id);
  res.status(200).json(response.success("Chat history retrieved successfully", history));
});

/**
 * Send a message to the AI and receive an empathetic response
 */
const sendMessage = asyncHandler(async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json(response.error("Message content is required"));
  }

  // 1. Get the current user's chat history
  const fullHistory = await chatModel.getChatHistory(req.user.id);
  // Filter context history to current session only if sessionId exists
  const sessionHistory = sessionId 
    ? fullHistory.filter(m => m.session_id === sessionId)
    : fullHistory;
  const contextHistory = sessionHistory.slice(-15);

  // 2. Call the Gemini service to analyze the prompt and generate an empathetic response
  const aiResponse = await geminiService.generateChatResponse(contextHistory, message.trim());

  // 3. Save the user message to PostgreSQL
  const savedUserMsg = await chatModel.addMessage(req.user.id, {
    sender: "user",
    message: message.trim(),
    isCrisis: false,
    sessionId: sessionId || null,
  });

  // Use the session_id from the user's saved message to make sure AI message matches
  const activeSessionId = savedUserMsg.session_id;

  // 4. Save the AI response to PostgreSQL
  const savedAiMsg = await chatModel.addMessage(req.user.id, {
    sender: "ai",
    message: aiResponse.text,
    isCrisis: aiResponse.isCrisis,
    sessionId: activeSessionId,
  });

  res.status(200).json(response.success("Message processed successfully", {
    id: savedAiMsg.id,
    sender: "ai",
    message: aiResponse.text,
    isCrisis: aiResponse.isCrisis,
    sessionId: activeSessionId,
    created_at: savedAiMsg.created_at,
  }));
});

/**
 * Clear the current user's chat history
 */
const clearChat = asyncHandler(async (req, res) => {
  await chatModel.clearChat(req.user.id);
  res.status(200).json(response.success("Chat history cleared successfully"));
});

/**
 * Delete a specific chat session for the current user
 */
const deleteChatSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json(response.error("Session ID is required"));
  }
  await chatModel.deleteSession(req.user.id, sessionId);
  res.status(200).json(response.success("Chat session deleted successfully"));
});

module.exports = {
  getChatHistory,
  sendMessage,
  clearChat,
  deleteChatSession,
};
