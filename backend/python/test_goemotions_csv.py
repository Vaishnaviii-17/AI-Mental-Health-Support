import csv
import json
from pathlib import Path

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

MODEL_DIR = BASE_DIR / "models" / "goemotions_emotion_model"
CSV_FILE = BASE_DIR / "datasets" / "goemotions_test" / "risk_sentiment_test.csv"

RISK_CONFIG_FILE = MODEL_DIR / "risk_config.json"
THRESHOLD_CONFIG_FILE = MODEL_DIR / "threshold_config.json"


# ============================================================
# LOAD CONFIG
# ============================================================

with open(RISK_CONFIG_FILE, "r", encoding="utf-8") as f:
    risk_config = json.load(f)

with open(THRESHOLD_CONFIG_FILE, "r", encoding="utf-8") as f:
    threshold_config = json.load(f)

PER_LABEL_THRESHOLDS = threshold_config["per_label_thresholds"]


# ============================================================
# DEVICE
# ============================================================

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print("=" * 70)
print("GOEMOTIONS CSV TEST")
print("=" * 70)

print(f"\nModel path : {MODEL_DIR}")
print(f"CSV path   : {CSV_FILE}")
print(f"Device     : {device}")

if torch.cuda.is_available():
    print(f"GPU        : {torch.cuda.get_device_name(0)}")


# ============================================================
# LOAD MODEL
# ============================================================

print("\nLoading tokenizer...")

tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)

print("Loading GoEmotions model...")

model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
model.to(device)
model.eval()

id2label = model.config.id2label

labels = [
    id2label[i]
    for i in range(len(id2label))
]

print(f"\nModel loaded successfully.")
print(f"Number of labels: {len(labels)}")
print("Labels:")
print(", ".join(labels))


# ============================================================
# SENTIMENT GROUPS
# ============================================================

positive_emotions = set(
    risk_config["sentiment_emotion_groups"]["positive_emotions"]
)

negative_emotions = set(
    risk_config["sentiment_emotion_groups"]["negative_emotions"]
)

neutral_emotions = set(
    risk_config["sentiment_emotion_groups"]["neutral_emotions"]
)


# ============================================================
# HELPER: EMOTION PREDICTION
# ============================================================

def predict_emotions(text):

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=512
    )

    inputs = {
        key: value.to(device)
        for key, value in inputs.items()
    }

    with torch.no_grad():
        outputs = model(**inputs)

    probabilities = torch.sigmoid(outputs.logits)[0]

    emotion_probs = {
        labels[i]: float(probabilities[i].cpu())
        for i in range(len(labels))
    }

    return emotion_probs


# ============================================================
# SENTIMENT
# ============================================================

def calculate_sentiment(emotion_probs):

    positive_score = sum(
        emotion_probs.get(e, 0)
        for e in positive_emotions
    )

    negative_score = sum(
        emotion_probs.get(e, 0)
        for e in negative_emotions
    )

    neutral_score = sum(
        emotion_probs.get(e, 0)
        for e in neutral_emotions
    )

    total = positive_score + negative_score + neutral_score

    if total > 0:
        positive_score /= total
        negative_score /= total
        neutral_score /= total

    if positive_score >= negative_score and positive_score >= neutral_score:
        sentiment = "positive"

    elif negative_score >= positive_score and negative_score >= neutral_score:
        sentiment = "negative"

    else:
        sentiment = "neutral"

    return sentiment


# ============================================================
# TEXT RISK PATTERNS
# ============================================================

risk_patterns = {
    "suicidal_ideation": [
        "suicide",
        "kill myself",
        "end my life",
        "ending my life",
        "want to die",
        "don't want to live",
        "do not want to live",
        "not want to be alive",
        "better off without me",
        "end everything",
        "ending everything",
        "not worth living",
    ],

    "self_harm": [
        "hurt myself",
        "harm myself",
        "self-harm",
        "self harm",
        "cut myself",
        "cutting myself",
        "self-harming",
        "self harming",
    ],

    "hopelessness": [
        "hopeless",
        "no hope",
        "no point",
        "nothing will change",
        "nothing ever changes",
        "never get better",
        "never get better",
        "no future",
        "nothing i do will make a difference",
        "nothing i do will ever make a difference",
        "not worth the effort",
        "not worth trying",
    ],

    "feeling_trapped": [
        "feel trapped",
        "feeling trapped",
        "trapped",
        "can't escape",
        "cannot escape",
        "no way out",
        "stuck with no way",
    ],

    "severe_distress": [
        "can't take this anymore",
        "cannot take this anymore",
        "can't go on",
        "cannot go on",
        "overwhelmed",
        "unbearable",
        "too much to handle",
    ]
}


# ============================================================
# PROTECTIVE PATTERNS
# ============================================================

protective_patterns = [
    "ask for help",
    "asking for help",
    "professional help",
    "call my therapist",
    "called my therapist",
    "talk to my therapist",
    "support group",
    "safety plan",
    "stay with someone",
    "stay with my family",
    "stay with my parents",
    "call my sister",
    "call my brother",
    "call my friend",
    "reach out",
    "reached out",
    "get help",
    "getting help",
    "going to therapy",
    "weekly therapy",
    "therapist",
    "psychiatrist",
]


# ============================================================
# RISK ANALYSIS
# ============================================================

def calculate_risk(text, emotion_probs):

    text_lower = text.lower()

    risk_signals = []

    for category, patterns in risk_patterns.items():

        found = False

        for pattern in patterns:

            if pattern in text_lower:
                found = True
                break

        if found:
            risk_signals.append(category)

    protective_signals = []

    for pattern in protective_patterns:

        if pattern in text_lower:
            protective_signals.append(pattern)

    # --------------------------------------------------------
    # Emotion component
    # --------------------------------------------------------

    distress_weights = risk_config["distress_emotion_weights"]

    emotion_component = 0.0

    for emotion, weight in distress_weights.items():

        probability = emotion_probs.get(emotion, 0)

        emotion_component += probability * weight

    emotion_component = min(emotion_component, 1.0)

    # --------------------------------------------------------
    # Text component
    # --------------------------------------------------------

    text_component = 0.0

    category_weights = risk_config["text_risk_pattern_categories"]

    for category in risk_signals:

        values = category_weights.get(category, [])

        if values:
            text_component = max(
                text_component,
                max(values)
            )

    # --------------------------------------------------------
    # Protective component
    # --------------------------------------------------------

    protective_emotion_weights = risk_config[
        "protective_emotion_weights"
    ]

    protective_component = 0.0

    for emotion, weight in protective_emotion_weights.items():

        probability = emotion_probs.get(emotion, 0)

        protective_component += probability * weight

    protective_component = min(protective_component, 1.0)

    # Add a small text-protective contribution
    if protective_signals:
        protective_component += min(
            len(protective_signals) * 0.05,
            0.25
        )

    protective_component = min(protective_component, 1.0)

    # --------------------------------------------------------
    # Final risk score
    # --------------------------------------------------------

    weights = risk_config["risk_weights"]

    risk_score = (
        emotion_component * weights["emotion_component"]
        + text_component * weights["text_component"]
        - protective_component * weights["protective_component"]
    )

    risk_score = max(0.0, min(risk_score, 1.0))

    # --------------------------------------------------------
    # Risk level
    # --------------------------------------------------------

    thresholds = risk_config["risk_thresholds"]

    if risk_score >= thresholds["high"]:
        risk_level = "critical"

    elif risk_score >= thresholds["elevated"]:
        risk_level = "high"

    elif risk_score >= thresholds["low"]:
        risk_level = "elevated"

    else:
        risk_level = "low"

    # Important:
    # Explicit high-severity text signals should not be hidden
    # by a low emotion score.

    if "suicidal_ideation" in risk_signals:

        if text_component >= 0.8:
            risk_level = "critical" if risk_score >= 0.75 else "high"

    elif "self_harm" in risk_signals:

        if text_component >= 0.7:
            risk_level = "high"

    return {
        "risk_level": risk_level,
        "risk_score": risk_score,
        "emotion_component": emotion_component,
        "text_component": text_component,
        "protective_component": protective_component,
        "risk_signals": risk_signals,
        "protective_signals": protective_signals
    }


# ============================================================
# ANALYZE ONE SENTENCE
# ============================================================

def analyze(text):

    emotion_probs = predict_emotions(text)

    sentiment = calculate_sentiment(emotion_probs)

    risk = calculate_risk(
        text,
        emotion_probs
    )

    return {
        "sentiment": sentiment,
        "risk_level": risk["risk_level"],
        "risk_score": risk["risk_score"],
        "risk_signals": risk["risk_signals"],
        "protective_signals": risk["protective_signals"],
        "emotions": emotion_probs
    }


# ============================================================
# LOAD CSV
# ============================================================

if not CSV_FILE.exists():

    print("\nERROR:")
    print(f"CSV file not found:\n{CSV_FILE}")
    raise SystemExit(1)


print("\nLoading CSV...")

with open(
    CSV_FILE,
    "r",
    encoding="utf-8-sig",
    newline=""
) as f:

    reader = csv.DictReader(f)

    rows = list(reader)


print(f"Loaded {len(rows)} test sentences.")


# ============================================================
# TEST ALL SENTENCES
# ============================================================

results = []

sentiment_correct = 0
risk_correct = 0
both_correct = 0

print("\n" + "=" * 70)
print("RUNNING TESTS")
print("=" * 70)


for index, row in enumerate(rows, start=1):

    text = row["text"].strip()

    expected_sentiment = row[
        "expected_sentiment"
    ].strip().lower()

    expected_risk = row[
        "expected_risk"
    ].strip().lower()

    category = row.get(
        "category",
        ""
    ).strip()

    prediction = analyze(text)

    predicted_sentiment = prediction[
        "sentiment"
    ]

    predicted_risk = prediction[
        "risk_level"
    ]

    sentiment_ok = (
        predicted_sentiment
        == expected_sentiment
    )

    risk_ok = (
        predicted_risk
        == expected_risk
    )

    both_ok = sentiment_ok and risk_ok

    if sentiment_ok:
        sentiment_correct += 1

    if risk_ok:
        risk_correct += 1

    if both_ok:
        both_correct += 1

    results.append({
        "id": row["id"],
        "category": category,
        "expected_sentiment": expected_sentiment,
        "predicted_sentiment": predicted_sentiment,
        "expected_risk": expected_risk,
        "predicted_risk": predicted_risk,
        "risk_score": prediction["risk_score"],
        "correct": both_ok,
        "text": text
    })

    status = "OK" if both_ok else "MISS"

    print(
        f"[{index:03d}/{len(rows)}] "
        f"{status} | "
        f"ID {row['id']} | "
        f"sentiment: {predicted_sentiment}/{expected_sentiment} | "
        f"risk: {predicted_risk}/{expected_risk}"
    )


# ============================================================
# METRICS
# ============================================================

total = len(rows)

sentiment_accuracy = (
    sentiment_correct / total
    if total else 0
)

risk_accuracy = (
    risk_correct / total
    if total else 0
)

overall_accuracy = (
    both_correct / total
    if total else 0
)


# ============================================================
# SUMMARY
# ============================================================

print("\n")
print("=" * 70)
print("TEST RESULTS")
print("=" * 70)

print(f"\nTotal sentences       : {total}")

print(
    f"Sentiment correct     : "
    f"{sentiment_correct}/{total}"
)

print(
    f"Sentiment accuracy    : "
    f"{sentiment_accuracy:.2%}"
)

print(
    f"\nRisk correct          : "
    f"{risk_correct}/{total}"
)

print(
    f"Risk accuracy         : "
    f"{risk_accuracy:.2%}"
)

print(
    f"\nBoth correct          : "
    f"{both_correct}/{total}"
)

print(
    f"Overall exact accuracy: "
    f"{overall_accuracy:.2%}"
)


# ============================================================
# SHOW MISCLASSIFICATIONS
# ============================================================

wrong = [
    r for r in results
    if not r["correct"]
]

print("\n" + "=" * 70)
print("MISCLASSIFICATIONS")
print("=" * 70)

print(
    f"\nTotal incorrect: {len(wrong)}"
)

for r in wrong:

    print("\n" + "-" * 70)

    print(f"ID: {r['id']}")
    print(f"Category: {r['category']}")

    print(
        f"Sentiment: "
        f"expected={r['expected_sentiment']} "
        f"predicted={r['predicted_sentiment']}"
    )

    print(
        f"Risk: "
        f"expected={r['expected_risk']} "
        f"predicted={r['predicted_risk']}"
    )

    print(
        f"Risk score: "
        f"{r['risk_score']:.3f}"
    )

    print(f"Text: {r['text']}")


# ============================================================
# SAVE RESULTS
# ============================================================

OUTPUT_DIR = BASE_DIR / "outputs" / "goemotions"

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True
)

RESULT_FILE = OUTPUT_DIR / "csv_test_results.csv"

with open(
    RESULT_FILE,
    "w",
    encoding="utf-8",
    newline=""
) as f:

    fieldnames = [
        "id",
        "category",
        "expected_sentiment",
        "predicted_sentiment",
        "expected_risk",
        "predicted_risk",
        "risk_score",
        "correct",
        "text"
    ]

    writer = csv.DictWriter(
        f,
        fieldnames=fieldnames
    )

    writer.writeheader()

    writer.writerows(results)


# ============================================================
# FINAL
# ============================================================

print("\n" + "=" * 70)
print("RESULT FILE")
print("=" * 70)

print(f"\nSaved detailed results to:")

print(RESULT_FILE)

print("\nTesting complete.")