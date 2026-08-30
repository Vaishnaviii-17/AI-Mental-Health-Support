const transcriptionService = require("../services/transcriptionService");
const response = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Transcribe a temporary audio recording.
 *
 * This endpoint only converts speech to text. It does not run chat,
 * GoEmotions, sentiment, risk, or any other mental-health processing.
 */
const transcribeAudio = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json(response.error("Audio file is required."));
  }

  let transcript;

  try {
    transcript = await transcriptionService.transcribeAudio(
      req.file,
      req.body?.language
    );
  } catch (err) {
    const status = err.statusCode || 503;
    return res.status(status).json(
      response.error(
        status === 413
          ? "Audio recording is too large."
          : err.message || "Unable to convert your speech. Please try again."
      )
    );
  }

  if (!transcript?.text || !transcript.text.trim()) {
    return res.status(422).json(response.error("No speech was detected in the recording."));
  }

  res.status(200).json(
    response.success("Audio transcribed successfully", {
      text: transcript.text.trim(),
      language: transcript.language || "en",
      duration: transcript.duration ?? null,
    })
  );
});

module.exports = {
  transcribeAudio,
};
