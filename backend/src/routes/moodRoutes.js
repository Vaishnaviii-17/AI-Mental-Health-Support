const express = require("express");
const moodController = require("../controllers/moodController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// All routes are protected by authMiddleware
router.use(authMiddleware);
// Get today's manual mood
router.get("/today", moodController.getTodayMood);
// Create today's manual mood
router.post("/checkin", moodController.createDailyMood);
// Update today's manual mood
router.put("/today", moodController.updateTodayMood);

router.get("/stats", moodController.getStats);
router.get("/history", moodController.getHistory);
router.get("/activity", moodController.getActivityCalendar);

module.exports = router;
