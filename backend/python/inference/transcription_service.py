"""
Whisper-powered speech-to-text service.

This module is intentionally separate from predictor.py so speech-to-text
can evolve independently from the GoEmotions journal analysis pipeline.
"""
import os
from pathlib import Path

try:
    from faster_whisper import WhisperModel
except ImportError:  # pragma: no cover - exercised when deps are missing locally
    WhisperModel = None


SUPPORTED_LANGUAGES = {
    "en": "en",
    "hi": "hi",
    "mr": "mr",
    "english": "en",
    "hindi": "hi",
    "marathi": "mr",
}

DEFAULT_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "auto")
DEFAULT_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
DEFAULT_DEVICE = os.getenv("WHISPER_DEVICE", "auto")
DEFAULT_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")


class TranscriptionService:
    """Lazy-loaded faster-whisper transcription wrapper."""

    def __init__(
        self,
        model_size=DEFAULT_MODEL_SIZE,
        language=DEFAULT_LANGUAGE,
        device=DEFAULT_DEVICE,
        compute_type=DEFAULT_COMPUTE_TYPE,
    ):
        self.model_size = model_size
        self.language = language
        self.device = device
        self.compute_type = compute_type
        self._model = None

    def _load_model(self):
        if WhisperModel is None:
            raise RuntimeError(
                "faster-whisper is not installed. Run pip install -r requirements.txt."
            )

        if self._model is None:
            print(
                "Loading Whisper transcription model:",
                self.model_size,
                "| language:",
                self.language,
            )
            self._model = WhisperModel(
                self.model_size,
                device=self.device,
                compute_type=self.compute_type,
            )

        return self._model

    def _normalize_language(self, language=None):
        value = (language or self.language or "en").strip().lower()
        normalized = SUPPORTED_LANGUAGES.get(value)

        if normalized is None:
            supported = ", ".join(sorted({"en", "hi", "mr"}))
            raise ValueError(
                f"unsupported transcription language. Supported languages: {supported}"
            )

        if normalized != "en" and self.model_size.endswith(".en"):
            raise ValueError(
                "Hindi and Marathi transcription require a multilingual Whisper "
                "model. Set WHISPER_MODEL_SIZE to tiny, base, small, medium, "
                "or large instead of an .en model."
            )

        return normalized

    def transcribe(self, audio_path, language=None):
        path = Path(audio_path)

        if not path.exists() or not path.is_file():
            raise ValueError("audio file does not exist")

        if path.stat().st_size <= 0:
            raise ValueError("audio file is empty")

        model = self._load_model()
        transcription_language = self._normalize_language(language)

        segments, info = model.transcribe(
            str(path),
            language=transcription_language,
            beam_size=5,
            vad_filter=True,
        )

        text = " ".join(segment.text.strip() for segment in segments).strip()

        return {
            "text": text,
            "language": getattr(info, "language", transcription_language) or transcription_language,
            "duration": getattr(info, "duration", None),
        }
