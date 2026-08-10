import json
import re
from pathlib import Path

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "models" / "goemotions_emotion_model"
RISK_CONFIG_PATH = MODEL_PATH / "risk_config.json"
THRESHOLD_CONFIG_PATH = MODEL_PATH / "threshold_config.json"
LABEL_MAPPING_PATH = MODEL_PATH / "label_mapping.json"

MAX_LENGTH = 128


# ============================================================
# LOAD CONFIGURATION
# ============================================================

def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


risk_config = load_json(RISK_CONFIG_PATH)
threshold_config = load_json(THRESHOLD_CONFIG_PATH)
label_mapping = load_json(LABEL_MAPPING_PATH)

id2label = {
    int(k): v
    for k, v in label_mapping["id2label"].items()
}

label2id = label_mapping["label2id"]

per_label_thresholds = threshold_config.get(
    "per_label_thresholds",
    {}
)

global_threshold = threshold_config.get(
    "global_threshold",
    0.30
)


# ============================================================
# DEVICE
# ============================================================

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)


# ============================================================
# LOAD TOKENIZER + MODEL
# ============================================================

print("=" * 70)
print("GOEMOTIONS RISK + SENTIMENT ANALYZER")
print("=" * 70)

print(f"\nModel path : {MODEL_PATH}")
print(f"Device     : {device}")

if device.type == "cuda":
    print(f"GPU        : {torch.cuda.get_device_name(0)}")

print("\nLoading tokenizer...")

tokenizer = AutoTokenizer.from_pretrained(
    str(MODEL_PATH)
)

print("Loading GoEmotions model...")

model = AutoModelForSequenceClassification.from_pretrained(
    str(MODEL_PATH)
)

model.to(device)
model.eval()

print("\nModel loaded successfully.")
print(f"Number of labels: {len(id2label)}")

print("\nLabels:")
print(", ".join(id2label.values()))


# ============================================================
# SENTIMENT GROUPS
# ============================================================

sentiment_groups = risk_config.get(
    "sentiment_emotion_groups",
    {}
)

positive_emotions = set(
    sentiment_groups.get("positive_emotions", [])
)

negative_emotions = set(
    sentiment_groups.get("negative_emotions", [])
)

neutral_emotions = set(
    sentiment_groups.get("neutral_emotions", [])
)


# ============================================================
# TEXT RISK PATTERNS
# ============================================================
#
# NOTE:
# These are screening/test patterns.
# They are NOT clinical diagnostic rules.
#
# The risk_config.json defines the categories and their
# severity values, but it does not contain the actual
# phrases to search for.
#
# Therefore this test script supplies explicit engineering
# patterns so the risk-indicator pipeline can actually be
# exercised.
# ============================================================

RISK_PATTERNS = {
    "suicidal_ideation": [
        r"\bkill myself\b",
        r"\bend my life\b",
        r"\bend it all\b",
        r"\bdon't want to live\b",
        r"\bdo not want to live\b",
        r"\bwant to die\b",
        r"\bwish i were dead\b",
        r"\bwish i was dead\b",
        r"\bsuicid(e|al)\b",
    ],

    "self_harm": [
        r"\bhurt myself\b",
        r"\bharm myself\b",
        r"\bself[- ]harm\b",
        r"\bcut myself\b",
        r"\bcutting myself\b",
        r"\bself[- ]injur(y|e|ing)\b",
    ],

    "hopelessness": [
        r"\bno hope\b",
        r"\bhopeless\b",
        r"\bnothing will get better\b",
        r"\bnever get better\b",
        r"\bno point\b",
        r"\bpointless\b",
        r"\bthere is no future\b",
        r"\bno future\b",
    ],

    "feeling_trapped": [
        r"\btrapped\b",
        r"\bcan't escape\b",
        r"\bcannot escape\b",
        r"\bno way out\b",
        r"\bnowhere to go\b",
    ],

    "severe_distress": [
        r"\bcompletely overwhelmed\b",
        r"\bcan't cope\b",
        r"\bcannot cope\b",
        r"\bbreaking down\b",
        r"\bfalling apart\b",
        r"\bcan't take this anymore\b",
        r"\bcannot take this anymore\b",
        r"\btoo much to handle\b",
    ],
}


# ============================================================
# PROTECTIVE TEXT PATTERNS
# ============================================================

PROTECTIVE_PATTERNS = [
    r"\bwant to get better\b",
    r"\bwant to recover\b",
    r"\bgetting help\b",
    r"\bseek help\b",
    r"\basking for help\b",
    r"\bmy therapist\b",
    r"\bmy doctor\b",
    r"\bmy family\b",
    r"\bmy friends\b",
    r"\bpeople who care about me\b",
    r"\bthings will get better\b",
    r"\bhopeful\b",
    r"\blooking forward to\b",
    r"\bgrateful\b",
    r"\bthankful\b",
]


# ============================================================
# MODEL PREDICTION
# ============================================================

def predict_emotions(text):
    """
    Run GoEmotions multi-label prediction.

    GoEmotions is multi-label, therefore sigmoid is used
    instead of softmax.
    """

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=MAX_LENGTH
    )

    inputs = {
        key: value.to(device)
        for key, value in inputs.items()
    }

    with torch.no_grad():
        outputs = model(**inputs)

    probabilities = torch.sigmoid(outputs.logits)[0]

    results = {}

    for index, probability in enumerate(probabilities):
        label = id2label[index]
        results[label] = float(probability.item())

    return results


# ============================================================
# ACTIVE EMOTIONS
# ============================================================

def get_active_emotions(probabilities):
    """
    Apply the saved per-label thresholds.
    """

    active = []

    for label, probability in probabilities.items():

        threshold = per_label_thresholds.get(
            label,
            global_threshold
        )

        if probability >= threshold:
            active.append(
                (label, probability, threshold)
            )

    active.sort(
        key=lambda x: x[1],
        reverse=True
    )

    return active


# ============================================================
# SENTIMENT ANALYSIS
# ============================================================

def calculate_sentiment(probabilities):
    """
    Derive sentiment from the GoEmotions emotion groups.

    This is NOT a separately trained sentiment classifier.
    It is a sentiment interpretation of GoEmotions outputs.
    """

    positive_score = sum(
        probabilities.get(label, 0.0)
        for label in positive_emotions
    )

    negative_score = sum(
        probabilities.get(label, 0.0)
        for label in negative_emotions
    )

    neutral_score = sum(
        probabilities.get(label, 0.0)
        for label in neutral_emotions
    )

    total = (
        positive_score
        + negative_score
        + neutral_score
    )

    if total > 0:
        positive_score /= total
        negative_score /= total
        neutral_score /= total

    scores = {
        "positive": positive_score,
        "negative": negative_score,
        "neutral": neutral_score,
    }

    sentiment = max(
        scores,
        key=scores.get
    )

    return sentiment, scores


# ============================================================
# TEXT RISK DETECTION
# ============================================================

def detect_risk_patterns(text):
    """
    Detect engineering screening patterns in the text.
    """

    normalized_text = text.lower()

    detected = {}

    for category, patterns in RISK_PATTERNS.items():

        matches = []

        for pattern in patterns:

            if re.search(
                pattern,
                normalized_text,
                flags=re.IGNORECASE
            ):
                matches.append(pattern)

        if matches:
            detected[category] = matches

    return detected


# ============================================================
# PROTECTIVE SIGNAL DETECTION
# ============================================================

def detect_protective_patterns(text):

    normalized_text = text.lower()

    matches = []

    for pattern in PROTECTIVE_PATTERNS:

        if re.search(
            pattern,
            normalized_text,
            flags=re.IGNORECASE
        ):
            matches.append(pattern)

    return matches


# ============================================================
# EMOTION-BASED DISTRESS SCORE
# ============================================================

def calculate_emotion_risk(probabilities):

    weights = risk_config.get(
        "distress_emotion_weights",
        {}
    )

    score = 0.0

    for emotion, weight in weights.items():

        probability = probabilities.get(
            emotion,
            0.0
        )

        score += probability * weight

    return min(score, 1.0)


# ============================================================
# PROTECTIVE EMOTION SCORE
# ============================================================

def calculate_protective_emotion_score(probabilities):

    weights = risk_config.get(
        "protective_emotion_weights",
        {}
    )

    score = 0.0

    for emotion, weight in weights.items():

        probability = probabilities.get(
            emotion,
            0.0
        )

        score += probability * weight

    return min(score, 1.0)


# ============================================================
# TEXT RISK SCORE
# ============================================================

def calculate_text_risk_score(detected_patterns):

    category_weights = risk_config.get(
        "text_risk_pattern_categories",
        {}
    )

    category_scores = {}

    for category, matches in detected_patterns.items():

        configured_values = category_weights.get(
            category,
            []
        )

        if not configured_values:
            category_scores[category] = 0.0
            continue

        match_count = len(matches)

        index = min(
            match_count - 1,
            len(configured_values) - 1
        )

        category_scores[category] = float(
            configured_values[index]
        )

    if not category_scores:
        return 0.0, {}

    # Highest detected risk category determines the
    # text-risk component rather than simply summing
    # everything together.
    text_score = max(
        category_scores.values()
    )

    return min(text_score, 1.0), category_scores


# ============================================================
# RISK LEVEL
# ============================================================

def get_risk_level(score):

    thresholds = risk_config.get(
        "risk_thresholds",
        {
            "low": 0.25,
            "elevated": 0.50,
            "high": 0.75,
        }
    )

    if score >= thresholds.get("high", 0.75):
        return "critical"

    if score >= thresholds.get("elevated", 0.50):
        return "high"

    if score >= thresholds.get("low", 0.25):
        return "elevated"

    return "low"


# ============================================================
# COMPLETE RISK ASSESSMENT
# ============================================================

def calculate_risk_assessment(
    probabilities,
    text
):

    detected_patterns = detect_risk_patterns(text)

    protective_patterns = detect_protective_patterns(text)

    emotion_score = calculate_emotion_risk(
        probabilities
    )

    protective_emotion_score = (
        calculate_protective_emotion_score(
            probabilities
        )
    )

    text_score, text_category_scores = (
        calculate_text_risk_score(
            detected_patterns
        )
    )

    weights = risk_config.get(
        "risk_weights",
        {}
    )

    emotion_weight = weights.get(
        "emotion_component",
        0.35
    )

    text_weight = weights.get(
        "text_component",
        0.65
    )

    protective_weight = weights.get(
        "protective_component",
        0.25
    )

    # Combine the configured components.
    #
    # Protective signals reduce the final risk score.
    raw_score = (
        emotion_score * emotion_weight
        + text_score * text_weight
        - protective_emotion_score * protective_weight
    )

    # Additional protective text signal.
    if protective_patterns:
        raw_score -= 0.05

    final_score = max(
        0.0,
        min(1.0, raw_score)
    )

    risk_level = get_risk_level(
        final_score
    )

    return {
        "risk_score": final_score,
        "risk_level": risk_level,
        "emotion_component": emotion_score,
        "text_component": text_score,
        "protective_emotion_component": (
            protective_emotion_score
        ),
        "detected_risk_categories": (
            list(detected_patterns.keys())
        ),
        "text_risk_category_scores": (
            text_category_scores
        ),
        "protective_text_signals": (
            len(protective_patterns)
        ),
        "risk_patterns": detected_patterns,
    }


# ============================================================
# DISPLAY RESULT
# ============================================================

def analyze_text(text):

    probabilities = predict_emotions(
        text
    )

    active_emotions = get_active_emotions(
        probabilities
    )

    sentiment, sentiment_scores = (
        calculate_sentiment(
            probabilities
        )
    )

    risk = calculate_risk_assessment(
        probabilities,
        text
    )

    print("\n")
    print("=" * 70)
    print("GOEMOTIONS ANALYSIS")
    print("=" * 70)

    print("\nTEXT:")
    print(text)

    # --------------------------------------------------------
    # SENTIMENT
    # --------------------------------------------------------

    print("\n" + "-" * 70)
    print("SENTIMENT")
    print("-" * 70)

    print(
        f"Overall sentiment: "
        f"{sentiment.upper()}"
    )

    print(
        f"Positive score: "
        f"{sentiment_scores['positive']:.3f}"
    )

    print(
        f"Negative score: "
        f"{sentiment_scores['negative']:.3f}"
    )

    print(
        f"Neutral score:  "
        f"{sentiment_scores['neutral']:.3f}"
    )

    # --------------------------------------------------------
    # EMOTIONS
    # --------------------------------------------------------

    print("\n" + "-" * 70)
    print("DETECTED EMOTIONS")
    print("-" * 70)

    if active_emotions:

        for label, probability, threshold in active_emotions:

            print(
                f"{label:<18} "
                f"{probability * 100:6.2f}% "
                f"(threshold {threshold:.2f})"
            )

    else:

        print(
            "No emotion exceeded its configured threshold."
        )

    # --------------------------------------------------------
    # TOP 10 RAW EMOTIONS
    # --------------------------------------------------------

    print("\n" + "-" * 70)
    print("TOP 10 EMOTION PROBABILITIES")
    print("-" * 70)

    top_emotions = sorted(
        probabilities.items(),
        key=lambda x: x[1],
        reverse=True
    )[:10]

    for label, probability in top_emotions:

        print(
            f"{label:<18} "
            f"{probability * 100:6.2f}%"
        )

    # --------------------------------------------------------
    # RISK
    # --------------------------------------------------------

    print("\n" + "-" * 70)
    print("RISK INDICATOR")
    print("-" * 70)

    print(
        f"Risk level : "
        f"{risk['risk_level'].upper()}"
    )

    print(
        f"Risk score : "
        f"{risk['risk_score']:.3f}"
    )

    print(
        f"\nEmotion component : "
        f"{risk['emotion_component']:.3f}"
    )

    print(
        f"Text component    : "
        f"{risk['text_component']:.3f}"
    )

    print(
        f"Protective component: "
        f"{risk['protective_emotion_component']:.3f}"
    )

    # --------------------------------------------------------
    # RISK SIGNALS
    # --------------------------------------------------------

    print("\nRisk signals:")

    if risk["detected_risk_categories"]:

        for category in risk[
            "detected_risk_categories"
        ]:

            print(f"  - {category}")

    else:

        print("  None detected")

    # --------------------------------------------------------
    # PROTECTIVE SIGNALS
    # --------------------------------------------------------

    print("\nProtective text signals:")

    if risk["protective_text_signals"] > 0:

        print(
            f"  {risk['protective_text_signals']} "
            f"protective signal(s) detected"
        )

    else:

        print("  None detected")

    # --------------------------------------------------------
    # DISCLAIMER
    # --------------------------------------------------------

    print("\n" + "-" * 70)
    print("IMPORTANT")
    print("-" * 70)

    print(
        "This risk assessment is an engineering heuristic "
        "screening indicator derived from emotion probabilities "
        "and text patterns."
    )

    print(
        "It is NOT a diagnosis, NOT a clinical risk probability, "
        "and has NOT been clinically validated."
    )

    print(
        "It should not replace professional assessment or "
        "human review."
    )

    print("=" * 70)


# ============================================================
# INTERACTIVE TEST LOOP
# ============================================================

def main():

    print("\n")
    print("=" * 70)
    print("INTERACTIVE GOEMOTIONS TEST")
    print("=" * 70)

    print(
        "\nEnter journal text to analyze."
    )

    print(
        "Type 'quit' to exit."
    )

    print(
        "\nThis model provides:"
    )

    print(
        "  1. 28-label GoEmotions analysis"
    )

    print(
        "  2. Sentiment interpretation"
    )

    print(
        "  3. Engineering risk indicator"
    )

    print(
        "  4. Protective/risk text signals"
    )

    while True:

        try:

            text = input(
                "\nYou: "
            ).strip()

        except (
            KeyboardInterrupt,
            EOFError
        ):

            print("\nExiting...")
            break

        if text.lower() == "quit":

            print("Exiting...")
            break

        if not text:

            print(
                "Please enter some text."
            )
            continue

        try:

            analyze_text(text)

        except Exception as e:

            print(
                "\nERROR while analyzing text:"
            )

            print(
                f"{type(e).__name__}: {e}"
            )


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()