const express = require("express");
const moodController = require("../controllers/moodController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// All routes are protected by authMiddleware
router.use(authMiddleware);

router.get("/stats", moodController.getStats);
router.get("/history", moodController.getHistory);
router.get("/activity", moodController.getActivityCalendar);

module.exports = router;
