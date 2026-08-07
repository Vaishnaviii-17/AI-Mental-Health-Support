const express = require("express");
const chatController = require("../controllers/chatController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// All routes are protected by authMiddleware
router.use(authMiddleware);

router.get("/history", chatController.getChatHistory);
router.post("/message", chatController.sendMessage);
router.delete("/clear", chatController.clearChat);
router.delete("/session/:sessionId", chatController.deleteChatSession);

module.exports = router;
