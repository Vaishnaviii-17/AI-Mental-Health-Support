import os

import numpy as np
import torch
from transformers import AutoFeatureExtractor, AutoModelForAudioClassification

from speech_emotion.mapping import dominant_emotion, map_speech_to_common
from speech_emotion.preprocess import TARGET_SAMPLE_RATE, chunk_waveform, load_audio_mono_16khz

MODEL_NAME = "Dpngtm/wav2vec2-emotion-recognition"


class SpeechEmotionService:
    """Lazy-loaded Wav2Vec2 speech-emotion wrapper for original audio."""

    def __init__(self, model_name=MODEL_NAME):
        self.model_name = os.getenv("SPEECH_EMOTION_MODEL", model_name)
        self.device = torch.device("cpu")
        self._feature_extractor = None
        self._model = None
        self._labels = None

    def _load_model(self):
        if self._model is None:
            print("Loading speech emotion model:", self.model_name)
            try:
                self._feature_extractor = AutoFeatureExtractor.from_pretrained(
                    self.model_name,
                    local_files_only=True,
                )
                self._model = AutoModelForAudioClassification.from_pretrained(
                    self.model_name,
                    local_files_only=True,
                )
            except Exception as exc:
                print(
                    "Speech emotion model not fully available in local cache; "
                    "trying Hugging Face download:",
                    f"{type(exc).__name__}: {exc}",
                )
                self._feature_extractor = AutoFeatureExtractor.from_pretrained(self.model_name)
                self._model = AutoModelForAudioClassification.from_pretrained(self.model_name)
            self._model.to(self.device)
            self._model.eval()
            self._labels = {
                int(index): str(label)
                for index, label in self._model.config.id2label.items()
            }
            print("Speech emotion model loaded successfully.")

        return self._feature_extractor, self._model, self._labels

    def _predict_chunk(self, waveform, sample_rate):
        feature_extractor, model, labels = self._load_model()
        inputs = feature_extractor(
            waveform,
            sampling_rate=sample_rate,
            return_tensors="pt",
            padding=True,
        )
        inputs = {key: value.to(self.device) for key, value in inputs.items()}

        with torch.inference_mode():
            outputs = model(**inputs)
            probabilities = torch.softmax(outputs.logits, dim=-1)[0].cpu().numpy()

        return {
            labels[index].lower(): float(probability)
            for index, probability in enumerate(probabilities)
        }

    @staticmethod
    def _aggregate_chunk_probabilities(chunk_probabilities):
        if not chunk_probabilities:
            return {}

        labels = sorted({label for chunk in chunk_probabilities for label in chunk.keys()})
        aggregated = {}

        for label in labels:
            aggregated[label] = float(np.mean([chunk.get(label, 0.0) for chunk in chunk_probabilities]))

        return aggregated

    @staticmethod
    def _dominant_native(probabilities):
        if not probabilities:
            return "neutral", 0.0

        label, confidence = max(
            probabilities.items(),
            key=lambda item: item[1],
        )
        return label, float(confidence)

    def analyze(self, audio_path):
        waveform, sample_rate = load_audio_mono_16khz(audio_path)
        chunks = chunk_waveform(waveform, sample_rate)

        if not chunks:
            raise ValueError("audio recording is too short for speech emotion analysis")

        chunk_probabilities = [
            self._predict_chunk(chunk, sample_rate)
            for chunk in chunks
        ]
        native_probabilities = self._aggregate_chunk_probabilities(chunk_probabilities)
        common_probabilities = map_speech_to_common(native_probabilities)
        native_dominant, native_confidence = self._dominant_native(native_probabilities)
        common_dominant, common_confidence = dominant_emotion(common_probabilities)

        return {
            "model": self.model_name,
            "dominant": native_dominant,
            "commonEmotion": common_dominant,
            "nativeProbabilities": native_probabilities,
            "probabilities": common_probabilities,
            "confidence": common_confidence,
            "nativeConfidence": native_confidence,
            "chunkCount": len(chunks),
            "sampleRate": TARGET_SAMPLE_RATE,
            "chunkSeconds": 8,
            "disclaimer": (
                "Speech emotion is an acoustic emotion signal, not a clinical "
                "assessment or diagnosis."
            ),
        }
