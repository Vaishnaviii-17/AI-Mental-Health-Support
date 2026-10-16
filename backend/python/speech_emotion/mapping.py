COMMON_EMOTIONS = (
    "joy",
    "sadness",
    "anger",
    "fear",
    "surprise",
    "neutral",
    "other",
)

SPEECH_TO_COMMON = {
    "happy": "joy",
    "sad": "sadness",
    "angry": "anger",
    "fear": "fear",
    "surprise": "surprise",
    "neutral": "neutral",
    "disgust": "other",
}

GOEMOTIONS_TO_COMMON = {
    "admiration": "joy",
    "amusement": "joy",
    "approval": "joy",
    "caring": "joy",
    "desire": "joy",
    "excitement": "joy",
    "gratitude": "joy",
    "joy": "joy",
    "love": "joy",
    "optimism": "joy",
    "pride": "joy",
    "relief": "joy",
    "sadness": "sadness",
    "grief": "sadness",
    "disappointment": "sadness",
    "remorse": "sadness",
    "anger": "anger",
    "annoyance": "anger",
    "disapproval": "anger",
    "fear": "fear",
    "nervousness": "fear",
    "surprise": "surprise",
    "realization": "surprise",
    "neutral": "neutral",
    "confusion": "other",
    "curiosity": "other",
    "disgust": "other",
    "embarrassment": "other",
}


def normalize_distribution(probabilities):
    normalized = {emotion: float(probabilities.get(emotion, 0.0)) for emotion in COMMON_EMOTIONS}
    total = sum(max(value, 0.0) for value in normalized.values())

    if total <= 0:
        return {emotion: (1.0 if emotion == "neutral" else 0.0) for emotion in COMMON_EMOTIONS}

    return {
        emotion: max(value, 0.0) / total
        for emotion, value in normalized.items()
    }


def map_goemotions_to_common(probabilities):
    mapped = {emotion: 0.0 for emotion in COMMON_EMOTIONS}

    for label, probability in (probabilities or {}).items():
        common = GOEMOTIONS_TO_COMMON.get(str(label).lower(), "other")
        mapped[common] += float(probability or 0.0)

    return normalize_distribution(mapped)


def map_speech_to_common(probabilities):
    mapped = {emotion: 0.0 for emotion in COMMON_EMOTIONS}

    for label, probability in (probabilities or {}).items():
        common = SPEECH_TO_COMMON.get(str(label).lower(), "other")
        mapped[common] += float(probability or 0.0)

    return normalize_distribution(mapped)


def dominant_emotion(probabilities):
    normalized = normalize_distribution(probabilities)
    label, confidence = max(normalized.items(), key=lambda item: item[1])
    return label, float(confidence)

