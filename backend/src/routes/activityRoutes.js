const express = require("express");
const activityController = require("../controllers/activityController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Secure all activity endpoints
router.use(authMiddleware);

// Define activity tracking routes
router.post("/sessions", activityController.createSession);
router.get("/history", activityController.getHistory);
router.get("/overall-stats", activityController.getOverallStats);
router.get("/wellness-time", activityController.getWellnessTime);
router.get("/stats/:activityType", activityController.getStats);
router.get("/best/:activityType", activityController.getBest);
router.post("/feedback", activityController.createFeedback);

module.exports = router;
