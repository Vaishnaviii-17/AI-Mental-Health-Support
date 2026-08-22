const express = require("express");
const journalController = require("../controllers/journalController");
const transcriptionController = require("../controllers/transcriptionController");
const authMiddleware = require("../middleware/authMiddleware");
const { uploadAudio } = require("../middleware/audioUpload");

const router = express.Router();

router.use(authMiddleware);

router.get("/", journalController.getJournals);
router.get("/recent", journalController.getRecentJournals);
router.post("/transcribe", uploadAudio, transcriptionController.transcribeAudio);
router.get("/:id", journalController.getJournalById);
router.post("/", journalController.createJournal);
router.delete("/:id", journalController.deleteJournal);

module.exports = router;