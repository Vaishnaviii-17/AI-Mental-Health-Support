const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoutes");
const journalRoutes = require("./routes/journalRoutes");
const moodRoutes = require("./routes/moodRoutes");
const userRoutes = require("./routes/userRoutes");
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

// Application Feature Routes
app.use("/api/chat", chatRoutes);
app.use("/api/journal", journalRoutes);
app.use("/api/mood", moodRoutes);
app.use("/api/user", userRoutes);

// 404 Handler
app.use(errorHandler);

module.exports = app;