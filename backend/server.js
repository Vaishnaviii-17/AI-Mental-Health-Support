const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const app = require("./src/app");
const pool = require("./src/config/db");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await pool.query("SELECT NOW()");
    console.log("✅ Database Connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Database Connection Failed");
    console.error(err);
  }
}

startServer();