const express = require("express");
const chatController = require("../controllers/chatController");
const transcriptionController = require("../controllers/transcriptionController");
const authMiddleware = require("../middleware/authMiddleware");
const { uploadAudio } = require("../middleware/audioUpload");

const router = express.Router();

// All routes are protected by authMiddleware
router.use(authMiddleware);

router.get("/history", chatController.getChatHistory);
router.post("/message", chatController.sendMessage);
router.post("/transcribe", uploadAudio, transcriptionController.transcribeAudio);
router.delete("/clear", chatController.clearChat);
router.delete("/session/:sessionId", chatController.deleteChatSession);

module.exports = router;
