const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
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

// 404 Handler
app.use(errorHandler);

module.exports = app;