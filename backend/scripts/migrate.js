const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const fs = require("fs");
const pool = require("../src/config/db");

async function migrate() {
  try {
    // Create migration tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationDir = path.join(__dirname, "../migrations");

    const files = fs
      .readdirSync(migrationDir)
      .filter(file => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const alreadyExecuted = await pool.query(
        "SELECT * FROM migrations WHERE filename = $1",
        [file]
      );

      if (alreadyExecuted.rows.length > 0) {
        console.log(`⏭ Skipping ${file}`);
        continue;
      }

      console.log(`🚀 Running ${file}`);

      const sql = fs.readFileSync(
        path.join(migrationDir, file),
        "utf8"
      );

      await pool.query(sql);

      await pool.query(
        "INSERT INTO migrations(filename) VALUES($1)",
        [file]
      );

      console.log(`✅ Completed ${file}`);
    }

    console.log("\n🎉 Database is up to date.");

    process.exit(0);

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrate();