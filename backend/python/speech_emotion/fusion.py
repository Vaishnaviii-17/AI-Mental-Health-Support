import math

from speech_emotion.mapping import COMMON_EMOTIONS, dominant_emotion, normalize_distribution

LOW_MISMATCH_THRESHOLD = 0.20
HIGH_MISMATCH_THRESHOLD = 0.40


def _kl_divergence(p_dist, q_dist):
    score = 0.0

    for emotion in COMMON_EMOTIONS:
        p_value = float(p_dist.get(emotion, 0.0))
        q_value = float(q_dist.get(emotion, 0.0))

        if p_value > 0 and q_value > 0:
            score += p_value * math.log2(p_value / q_value)

    return score


def jensen_shannon_distance(first, second):
    p_dist = normalize_distribution(first)
    q_dist = normalize_distribution(second)
    midpoint = {
        emotion: (p_dist[emotion] + q_dist[emotion]) / 2.0
        for emotion in COMMON_EMOTIONS
    }

    divergence = 0.5 * _kl_divergence(p_dist, midpoint) + 0.5 * _kl_divergence(q_dist, midpoint)
    return math.sqrt(max(divergence, 0.0))


def mismatch_category(score):
    if score < LOW_MISMATCH_THRESHOLD:
        return "low"
    if score < HIGH_MISMATCH_THRESHOLD:
        return "moderate"
    return "high"


def confidence_weights(text_confidence, voice_confidence):
    text_value = max(float(text_confidence or 0.0), 0.0)
    voice_value = max(float(voice_confidence or 0.0), 0.0)
    total = text_value + voice_value

    if total <= 0:
        return 0.5, 0.5

    return text_value / total, voice_value / total


def fuse_emotions(text_probabilities, voice_probabilities):
    text_common = normalize_distribution(text_probabilities)
    voice_common = normalize_distribution(voice_probabilities)
    text_dominant, text_confidence = dominant_emotion(text_common)
    voice_dominant, voice_confidence = dominant_emotion(voice_common)
    score = jensen_shannon_distance(text_common, voice_common)
    category = mismatch_category(score)
    text_weight, voice_weight = confidence_weights(text_confidence, voice_confidence)

    fused = {
        emotion: text_weight * text_common[emotion] + voice_weight * voice_common[emotion]
        for emotion in COMMON_EMOTIONS
    }
    fused = normalize_distribution(fused)

    if category == "high":
        final_mood = "mixed"
        display_label = "Mixed emotional signals"
    else:
        final_mood, _ = dominant_emotion(fused)
        display_label = final_mood

    return {
        "textEmotion": {
            "dominant": text_dominant,
            "probabilities": text_common,
            "confidence": text_confidence,
        },
        "mismatch": {
            "score": round(float(score), 4),
            "category": category,
            "thresholds": {
                "low": LOW_MISMATCH_THRESHOLD,
                "high": HIGH_MISMATCH_THRESHOLD,
            },
        },
        "fusion": {
            "method": "confidence_weighted_late_fusion",
            "finalMood": final_mood,
            "displayLabel": display_label,
            "probabilities": fused,
            "weights": {
                "text": text_weight,
                "voice": voice_weight,
            },
        },
    }

