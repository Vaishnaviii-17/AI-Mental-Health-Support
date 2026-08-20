const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoutes");
const journalRoutes = require("./routes/journalRoutes");
const moodRoutes = require("./routes/moodRoutes");
const userRoutes = require("./routes/userRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const authMiddleware = require("./middleware/authMiddleware");
const activityRoutes = require("./routes/activityRoutes");
const userController = require("./controllers/userController");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

// Health Check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Mental Health Support Backend Running",
  });
});

// Authentication Routes
app.use("/api/auth", authRoutes);

// Dashboard Routes
app.use("/api/dashboard", dashboardRoutes);

// Profile & Recommendation Routes (needed by frontend dashboardService)
app.get("/api/profile", authMiddleware, userController.getProfile);
app.get("/api/recommendation", authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      title: "A three-minute breathing reset",
      description: "A gentle pause to settle your body and make a little space for the rest of your day.",
      duration: "3 min",
      type: "Breathing exercise"
    }
  });
});

// Application Feature Routes
app.use("/api/chat", chatRoutes);
app.use("/api/journal", journalRoutes);
app.use("/api/mood", moodRoutes);
app.use("/api/user", userRoutes);
app.use("/api/activities", activityRoutes);

// 404 Handler
app.use(errorHandler);

module.exports = app;