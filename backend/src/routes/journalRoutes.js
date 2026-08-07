const express = require("express");
const journalController = require("../controllers/journalController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// All routes are protected by authMiddleware
router.use(authMiddleware);

router.get("/", journalController.getJournals);
router.get("/:id", journalController.getJournalById);
router.post("/", journalController.createJournal);
router.delete("/:id", journalController.deleteJournal);

module.exports = router;
