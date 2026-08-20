const activityModel = require("../models/activityModel");
const response = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Log a new activity session.
 */
const createSession = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { activity_type, score, duration_seconds, completed, metadata } = req.body;

  if (!activity_type) {
    return res.status(400).json(response.error("activity_type is required."));
  }
  if (score === undefined || score === null) {
    return res.status(400).json(response.error("score is required."));
  }
  if (!duration_seconds) {
    return res.status(400).json(response.error("duration_seconds is required."));
  }

  const sessionResult = await activityModel.createSession(userId, {
    activityType: activity_type,
    score: Number(score),
    durationSeconds: Number(duration_seconds),
    completed: Boolean(completed),
    metadata: metadata || {}
  });

  return res.status(201).json(
    response.success("Activity session saved successfully", sessionResult)
  );
});

/**
 * Save user feedback for a session.
 */
const createFeedback = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { activity_session_id, rating } = req.body;

  if (!activity_session_id) {
    return res.status(400).json(response.error("activity_session_id is required."));
  }

  const numRating = Number(rating);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json(response.error("rating must be an integer between 1 and 5."));
  }

  try {
    const feedback = await activityModel.createFeedback(userId, {
      activitySessionId: activity_session_id,
      rating: numRating
    });
    return res.status(201).json(
      response.success("Feedback submitted successfully", feedback)
    );
  } catch (err) {
    if (err.message.includes("not found or access denied")) {
      return res.status(403).json(response.error(err.message));
    }
    throw err;
  }
});

/**
 * Fetch session history with pagination.
 */
const getHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));

  const history = await activityModel.getSessionHistory(userId, page, limit);
  const totalCompleted = await activityModel.getTotalCompletedCount(userId);

  return res.status(200).json(
    response.success("Activity history retrieved successfully", {
      ...history,
      totalCompleted
    })
  );
});

/**
 * Fetch aggregate statistics for an activity type.
 */
const getStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { activityType } = req.params;

  if (!["pop_stress", "memory_match", "breathing_bubble"].includes(activityType)) {
    return res.status(400).json(response.error("Invalid activity type."));
  }

  const stats = await activityModel.getBestStats(userId, activityType);
  return res.status(200).json(
    response.success("Activity stats retrieved successfully", stats)
  );
});

/**
 * Fetch best result (high score) for an activity.
 * Returns the highest score recorded for the given activity.
 */
const getBest = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { activityType } = req.params;

  if (!["pop_stress", "memory_match", "breathing_bubble"].includes(activityType)) {
    return res.status(400).json(response.error("Invalid activity type."));
  }

  const stats = await activityModel.getBestStats(userId, activityType);
  const bestScore = activityType === "breathing_bubble" 
    ? stats.bestCompletion 
    : stats.bestScore;

  return res.status(200).json(
    response.success("Best score retrieved successfully", { bestScore })
  );
});

/**
 * Fetch dynamic overall dashboard, analytics, and garden statistics.
 */
const getOverallStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const rawStats = await activityModel.getOverallStatsData(userId);
  const count = rawStats.completedCount;

  // Centralized Garden Progression Thresholds
  const stages = [
    { level: 0, min: 0, max: 0, name: "Seed", next: 1 },
    { level: 1, min: 1, max: 4, name: "Sprout", next: 5 },
    { level: 2, min: 5, max: 9, name: "Growing", next: 10 },
    { level: 3, min: 10, max: 19, name: "Young Plant", next: 20 },
    { level: 4, min: 20, max: Infinity, name: "Blooming", next: null }
  ];

  const currentStage = stages.find(s => count >= s.min && count <= s.max) || stages[0];

  const garden = {
    completedActivities: count,
    gardenLevel: currentStage.level,
    gardenStage: currentStage.name,
    nextLevelAt: currentStage.next,
    progressToNextLevel: currentStage.next ? Math.round((count / currentStage.next) * 100) : 100
  };

  // Centralized Activity to Category mapping
  const ACTIVITY_CATEGORY_MAP = {
    breathing_bubble: "relaxation",
    pop_stress: "stress_relief",
    memory_match: "focus"
  };

  const categoryTime = {
    relaxation: 0,
    stress_relief: 0,
    focus: 0,
    self_reflection: 0,
    support: 0
  };

  if (rawStats.catDurations) {
    rawStats.catDurations.forEach(item => {
      const cat = ACTIVITY_CATEGORY_MAP[item.activityType];
      if (cat && categoryTime[cat] !== undefined) {
        categoryTime[cat] += item.seconds;
      }
    });
  }

  return res.status(200).json(
    response.success("Overall stats retrieved successfully", {
      garden,
      feedback: rawStats.feedback,
      summary: {
        completedCount: count,
        totalPlays: rawStats.totalPlays,
        totalDurationSeconds: rawStats.totalDurationSeconds,
        mostPlayedActivity: rawStats.mostPlayedActivity
      },
      distribution: rawStats.distribution,
      trend: rawStats.trend,
      todayMindfulSeconds: rawStats.todayMindfulSeconds || 0,
      weekMindfulSeconds: rawStats.weekMindualSeconds || rawStats.weekMindfulSeconds || 0,
      totalMindfulSeconds: rawStats.totalMindfulSeconds || 0,
      categoryTime
    })
  );
});

/**
 * Fetch dedicated mindful wellness time statistics and daily logs.
 */
const getWellnessTime = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const rawData = await activityModel.getWellnessTimeData(userId);

  // Centralized Activity to Category mapping
  const ACTIVITY_CATEGORY_MAP = {
    breathing_bubble: "relaxation",
    pop_stress: "stress_relief",
    memory_match: "focus"
  };

  const categoryTime = {
    relaxation: 0,
    stress_relief: 0,
    focus: 0,
    self_reflection: 0,
    support: 0
  };

  if (rawData.catDurations) {
    rawData.catDurations.forEach(item => {
      const cat = ACTIVITY_CATEGORY_MAP[item.activityType];
      if (cat && categoryTime[cat] !== undefined) {
        categoryTime[cat] += item.seconds;
      }
    });
  }

  return res.status(200).json(
    response.success("Wellness time retrieved successfully", {
      todayMindfulSeconds: rawData.todayMindfulSeconds || 0,
      weekMindfulSeconds: rawData.weekMindfulSeconds || 0,
      totalMindfulSeconds: rawData.totalMindfulSeconds || 0,
      mostPlayedActivity: rawData.mostPlayedActivity,
      categoryTime,
      dailyTime: rawData.dailyTime
    })
  );
});

module.exports = {
  createSession,
  createFeedback,
  getHistory,
  getStats,
  getBest,
  getOverallStats,
  getWellnessTime
};
