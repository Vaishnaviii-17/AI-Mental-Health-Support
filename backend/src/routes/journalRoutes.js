const express = require("express");
const multer = require("multer");
const journalController = require("../controllers/journalController");
const authMiddleware = require("../middleware/authMiddleware");
const response = require("../utils/response");

const router = express.Router();

const MAX_AUDIO_BYTES =
  Number(process.env.TRANSCRIPTION_MAX_AUDIO_BYTES) || 10 * 1024 * 1024;

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/ogg",
  "video/webm",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AUDIO_BYTES,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_AUDIO_TYPES.has(file.mimetype)) {
      return cb(new Error("Unsupported audio format."));
    }

    return cb(null, true);
  },
});

function uploadAudio(req, res, next) {
  upload.single("audio")(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json(response.error("Audio recording is too large."));
    }

    return res
      .status(400)
      .json(response.error(err.message || "Invalid audio upload."));
  });
}

// All routes are protected by authMiddleware
router.use(authMiddleware);

router.get("/", journalController.getJournals);
router.get("/recent", journalController.getRecentJournals);
router.post("/transcribe", uploadAudio, journalController.transcribeJournalAudio);
router.get("/:id", journalController.getJournalById);
router.post("/", journalController.createJournal);
router.delete("/:id", journalController.deleteJournal);

module.exports = router;
