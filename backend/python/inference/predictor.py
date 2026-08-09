import json
import re
from pathlib import Path

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


class MentalHealthPredictor:
    """
    Unified inference layer for the two trained models.

    Model 1:
        6-class emotion model
        sadness, joy, love, anger, fear, surprise

    Model 2:
        GoEmotions model
        Used for sentiment interpretation, engineering risk
        screening, and (as of this version) as the deciding
        corroboration signal for the final emotion -- see
        "FINAL EMOTION SELECTION" below.

    Architecture:

        Primary model:
            6-class emotion classification. This is a FORCED-CHOICE
            softmax over exactly six categories -- it has no
            neutral/low-intensity/approval option. That means it can
            be extremely confident (even ~100%) on inputs that don't
            genuinely belong to any of its six categories, because it
            is mathematically incapable of expressing "none of the
            above". Its raw confidence/margin therefore cannot be
            trusted in isolation.

        GoEmotions:
            28-label multi-label model (sigmoid). Independently used
            for sentiment and risk analysis (unchanged). It is ALSO
            now used to independently corroborate (or veto) the
            primary model's pick before that pick is trusted -- see
            select_final_emotion().

        Final emotion selection (select_final_emotion):
            The primary model's pick is used as-is ONLY when both
            (a) the primary model's own confidence/margin are healthy,
            AND (b) GoEmotions independently assigns meaningful
            probability mass to that SAME category. If GoEmotions'
            combined mass across all six categories is low (i.e. the
            input is dominated by GoEmotions labels the six-class
            schema has no slot for, e.g. "approval", "neutral",
            "realization"), the result is the explicit sentinel
            emotion "neutral" -- which is intentionally OUTSIDE the
            six supported labels. Otherwise, if GoEmotions clearly
            supports a specific (possibly different) one of the six
            categories, that category is used instead.

    -------------------------------------------------------------
    SCHEMA NOTE
    -------------------------------------------------------------
    The application's `emotion` column / mlMapping.js SUPPORTED_EMOTIONS
    set only accepts the six original labels. "neutral" is a
    DELIBERATE out-of-schema sentinel: mlMapping.js's existing
    validity guard already drops any value outside SUPPORTED_EMOTIONS
    rather than storing it (logging a warning), so a low-intensity /
    unclassifiable result safely results in a null `emotion` column
    instead of a fabricated, misleading six-class label. No changes
    to mlMapping.js, journalController.js, or the frontend are
    required or made by this fix.
    """

    MAX_LENGTH = 128

    # -------------------------------------------------------------
    # PRIMARY MODEL CONFIDENCE / AMBIGUITY SETTINGS
    # -------------------------------------------------------------

    # Minimum confidence required for the primary model to be
    # considered reliable.
    PRIMARY_CONFIDENCE_THRESHOLD = 0.60

    # Minimum difference required between the first and second
    # primary-model predictions.
    #
    # Example:
    # joy = 0.72
    # sadness = 0.30
    # margin = 0.42
    #
    # This is clearly separated.
    #
    # But:
    # joy = 0.38
    # sadness = 0.34
    # margin = 0.04
    #
    # This is ambiguous.
    PRIMARY_MARGIN_THRESHOLD = 0.15

    EMOTION_LABELS = [
        "sadness",
        "joy",
        "love",
        "anger",
        "fear",
        "surprise",
    ]

    # -------------------------------------------------------------
    # GOEMOTIONS -> SIX-CLASS COMPATIBILITY MAPPING
    # -------------------------------------------------------------
    #
    # This is NOT a claim that these emotions are clinically
    # equivalent. It is only a deterministic compatibility
    # mapping used to translate GoEmotions' finer-grained labels
    # into the six categories the rest of the application
    # (database, frontend, journalController) already expects.
    #
    # Any GoEmotions label not listed here (e.g. "neutral",
    # "approval", "curiosity", "admiration", "realization",
    # "disapproval", "disappointment"... note "disappointment" IS
    # mapped below, to sadness) is simply ignored when computing
    # the aggregated fallback / coverage scores. That is precisely
    # what makes SIX_CLASS_COVERAGE_THRESHOLD (see
    # select_final_emotion) a meaningful signal: a text whose
    # GoEmotions mass sits almost entirely in unmapped labels is a
    # text none of the six categories genuinely describes.
    GOEMOTIONS_TO_SIX_MAP = {
        "sadness": "sadness",
        "grief": "sadness",
        "disappointment": "sadness",
        "remorse": "sadness",
        "loneliness": "sadness",

        "joy": "joy",
        "amusement": "joy",
        "excitement": "joy",
        "optimism": "joy",
        "relief": "joy",
        "pride": "joy",
        "gratitude": "joy",

        "love": "love",
        "caring": "love",
        "affection": "love",
        "desire": "love",

        "anger": "anger",
        "annoyance": "anger",
        "rage": "anger",
        "frustration": "anger",
        "disgust": "anger",

        "fear": "fear",
        "nervousness": "fear",
        "anxiety": "fear",
        "apprehension": "fear",

        "surprise": "surprise",
        "confusion": "surprise",
    }

    # Minimum raw aggregated score the top fallback category must
    # reach to be considered a meaningful signal. Below this, the
    # fallback still returns the top category (to keep the
    # existing six-label contract intact) but flags the result as
    # ambiguous via `fallback_was_ambiguous`.
    FALLBACK_MIN_SIGNAL_THRESHOLD = 0.15

    # Minimum normalized margin between the top and second
    # aggregated fallback categories. Below this, the fallback
    # result is flagged as ambiguous.
    FALLBACK_MIN_MARGIN = 0.05

    # -------------------------------------------------------------
    # FINAL EMOTION SELECTION THRESHOLDS (NEW)
    # -------------------------------------------------------------
    #
    # These two thresholds are intentionally NOT the same knobs as
    # PRIMARY_CONFIDENCE_THRESHOLD / PRIMARY_MARGIN_THRESHOLD above.
    # Turning those two down would only make the primary model
    # defer to GoEmotions more often when *it itself* is unsure --
    # it does nothing for the case that actually broke ("i am ok"),
    # where the primary model is fully confident and unambiguous
    # but simply wrong, because none of its six categories applies.
    # These two thresholds instead measure whether GoEmotions
    # independently corroborates the primary model's pick at all.

    # Minimum TOTAL GoEmotions probability mass mapped across ALL
    # SIX primary-model categories combined (see
    # GOEMOTIONS_TO_SIX_MAP). This does not care which category
    # wins -- it measures whether GoEmotions considers *any* of the
    # six categories relevant. A low value means the input is
    # dominated by GoEmotions labels with no six-class equivalent
    # (e.g. "approval", "neutral", "realization"), regardless of
    # how confident the forced six-way primary softmax is.
    SIX_CLASS_COVERAGE_THRESHOLD = 0.30

    # Minimum GoEmotions-aggregated mass specifically for the SAME
    # category the primary model chose. Even when overall six-class
    # coverage clears SIX_CLASS_COVERAGE_THRESHOLD, the primary
    # model's specific pick still needs some independent
    # corroboration from GoEmotions before being trusted outright.
    PRIMARY_COROBORATION_THRESHOLD = 0.15

    # Minimum aggregated GoEmotions score required before a
    # different six-class emotion can override the primary model.
    GOEMOTIONS_OVERRIDE_MIN_SIGNAL = 0.30

    # Minimum advantage the GoEmotions top category must have
    # over the primary model's category before overriding it.
    GOEMOTIONS_OVERRIDE_MARGIN = 0.10

    def __init__(self, base_dir=None):
        # ---------------------------------------------------------
        # PATHS
        # ---------------------------------------------------------

        if base_dir is None:
            base_dir = Path(__file__).resolve().parent.parent

        self.base_dir = Path(base_dir)

        self.emotion_model_path = (
            self.base_dir / "models" / "emotion_model"
        )

        self.goemotions_model_path = (
            self.base_dir / "models" / "goemotions_emotion_model"
        )

        self.risk_config_path = (
            self.goemotions_model_path / "risk_config.json"
        )

        self.threshold_config_path = (
            self.goemotions_model_path / "threshold_config.json"
        )

        self.label_mapping_path = (
            self.goemotions_model_path / "label_mapping.json"
        )

        # ---------------------------------------------------------
        # DEVICE
        # ---------------------------------------------------------

        self.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )

        # ---------------------------------------------------------
        # LOAD CONFIG
        # ---------------------------------------------------------

        self.risk_config = self._load_json(self.risk_config_path)
        self.threshold_config = self._load_json(self.threshold_config_path)
        self.label_mapping = self._load_json(self.label_mapping_path)

        self.id2label = {
            int(k): v
            for k, v in self.label_mapping["id2label"].items()
        }

        self.label2id = self.label_mapping["label2id"]

        self.per_label_thresholds = self.threshold_config.get(
            "per_label_thresholds", {}
        )

        self.global_threshold = self.threshold_config.get(
            "global_threshold", 0.30
        )

        # ---------------------------------------------------------
        # SENTIMENT GROUPS
        # ---------------------------------------------------------

        sentiment_groups = self.risk_config.get(
            "sentiment_emotion_groups", {}
        )

        self.positive_emotions = set(
            sentiment_groups.get("positive_emotions", [])
        )
        self.negative_emotions = set(
            sentiment_groups.get("negative_emotions", [])
        )
        self.neutral_emotions = set(
            sentiment_groups.get("neutral_emotions", [])
        )

        # ---------------------------------------------------------
        # LOAD MODEL 1
        # ---------------------------------------------------------

        print("Loading 6-class emotion model...")

        self.emotion_tokenizer = AutoTokenizer.from_pretrained(
            str(self.emotion_model_path)
        )
        self.emotion_model = AutoModelForSequenceClassification.from_pretrained(
            str(self.emotion_model_path)
        )
        self.emotion_model.to(self.device)
        self.emotion_model.eval()

        # ---------------------------------------------------------
        # LOAD MODEL 2
        # ---------------------------------------------------------

        print("Loading GoEmotions model...")

        self.goemotions_tokenizer = AutoTokenizer.from_pretrained(
            str(self.goemotions_model_path)
        )
        self.goemotions_model = AutoModelForSequenceClassification.from_pretrained(
            str(self.goemotions_model_path)
        )
        self.goemotions_model.to(self.device)
        self.goemotions_model.eval()

        print("Both models loaded successfully.")
        print(
             "🔥 ACTUAL PREDICTOR FILE:",
            Path(__file__).resolve()
        )
        print(
            "🔥 SIX_CLASS_COVERAGE_THRESHOLD:",
            self.SIX_CLASS_COVERAGE_THRESHOLD
        )
        print(
            "🔥 PRIMARY_COROBORATION_THRESHOLD:",
            self.PRIMARY_COROBORATION_THRESHOLD
        )


    # =============================================================
    # UTILITY
    # =============================================================

    @staticmethod
    def _load_json(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    # =============================================================
    # MODEL 1 — PRIMARY EMOTION
    # =============================================================

    def predict_primary_emotion(self, text):
        """
        Predict the primary emotion using the trained 6-class
        emotion model.

        Also determines whether the prediction is confident enough
        to be trusted on its own, or whether it is low-confidence /
        ambiguous. NOTE: this flag alone is no longer sufficient to
        decide the final emotion -- see select_final_emotion(),
        which additionally requires GoEmotions corroboration even
        when this flag is False.
        """

        inputs = self.emotion_tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            padding=True,
            max_length=self.MAX_LENGTH,
        )

        inputs = {key: value.to(self.device) for key, value in inputs.items()}

        with torch.no_grad():
            outputs = self.emotion_model(**inputs)

        probabilities = torch.softmax(outputs.logits, dim=1)[0]

        predicted_index = torch.argmax(probabilities).item()
        primary_emotion = self.EMOTION_LABELS[predicted_index]
        confidence = float(probabilities[predicted_index].item())

        top_values, top_indices = torch.topk(
            probabilities, min(3, len(self.EMOTION_LABELS))
        )

        top_emotions = []
        for value, index in zip(top_values, top_indices):
            top_emotions.append({
                "emotion": self.EMOTION_LABELS[index.item()],
                "confidence": float(value.item()),
            })

        if len(top_emotions) > 1:
            second_confidence = top_emotions[1]["confidence"]
        else:
            second_confidence = 0.0

        margin = confidence - second_confidence

        is_low_confidence = confidence < self.PRIMARY_CONFIDENCE_THRESHOLD
        is_ambiguous = margin < self.PRIMARY_MARGIN_THRESHOLD
        needs_goemotions_fallback = is_low_confidence or is_ambiguous

        return {
            "emotion": primary_emotion,
            "confidence": confidence,
            "top_emotions": top_emotions,
            "second_confidence": second_confidence,
            "margin": margin,
            "is_low_confidence": is_low_confidence,
            "is_ambiguous": is_ambiguous,
            "needs_goemotions_fallback": needs_goemotions_fallback,
            "source": "primary_model",
        }

    # =============================================================
    # MODEL 2 — GOEMOTIONS
    # =============================================================

    def predict_goemotions(self, text):
        """
        Run GoEmotions multi-label prediction.

        Sigmoid is used because GoEmotions is treated as a
        multi-label classifier here.
        """

        inputs = self.goemotions_tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            padding=True,
            max_length=self.MAX_LENGTH,
        )

        inputs = {key: value.to(self.device) for key, value in inputs.items()}

        with torch.no_grad():
            outputs = self.goemotions_model(**inputs)

        probabilities = torch.sigmoid(outputs.logits)[0]

        results = {}
        for index, probability in enumerate(probabilities):
            label = self.id2label[index]
            results[label] = float(probability.item())

        return results

    # =============================================================
    # GOEMOTIONS -> SIX-CLASS AGGREGATION
    # =============================================================

    def calculate_goemotions_fallback_scores(self, probabilities):
        """
        Aggregate GoEmotions probabilities into the six
        primary-model emotion categories using GOEMOTIONS_TO_SIX_MAP.

        For each supported emotion, the aggregated score is the sum
        of the probabilities of every GoEmotions label that maps
        onto it. GoEmotions labels with no mapping (e.g. "neutral",
        "approval", "curiosity", "admiration") are ignored for this
        calculation, though they remain visible in
        goemotions.probabilities / goemotions.active_emotions.

        Returns a dict with exactly the six supported emotions as
        keys, defaulting to 0.0 when no mapped label is present.

        This is also the basis of SIX_CLASS_COVERAGE_THRESHOLD in
        select_final_emotion(): summing this dict's values tells you
        how much of the input's total GoEmotions probability mass
        maps to ANY six-class category at all.
        """

        scores = {emotion: 0.0 for emotion in self.EMOTION_LABELS}

        for label, probability in probabilities.items():
            mapped_emotion = self.GOEMOTIONS_TO_SIX_MAP.get(label)

            if mapped_emotion is None:
                continue

            scores[mapped_emotion] += probability

        return scores

    # =============================================================
    # GOEMOTIONS FALLBACK SELECTOR
    # =============================================================

    def select_goemotions_emotion(self, probabilities):
        """
        Select the best-supported six-class category according to
        GoEmotions alone (used by select_final_emotion() whenever
        the primary model's pick needs reconsideration).

        Unlike a raw GoEmotions argmax, this aggregates GoEmotions
        probabilities into the six supported emotion categories (see
        calculate_goemotions_fallback_scores) and selects the
        highest-scoring supported category, so the fallback always
        returns one of: sadness, joy, love, anger, fear, surprise.

        `confidence` here is NOT a calibrated model confidence. It
        is the normalized dominance of the selected category among
        the six aggregated scores (i.e. how much of the aggregated
        "mapped emotion mass" belongs to the winning category).
        """

        fallback_scores = self.calculate_goemotions_fallback_scores(probabilities)

        ranked = sorted(
            fallback_scores.items(), key=lambda item: item[1], reverse=True
        )

        top_emotion, top_raw_score = ranked[0]
        second_raw_score = ranked[1][1] if len(ranked) > 1 else 0.0

        total = sum(fallback_scores.values())

        if total > 0:
            normalized_scores = {
                emotion: score / total for emotion, score in fallback_scores.items()
            }
        else:
            normalized_scores = {emotion: 0.0 for emotion in fallback_scores}

        top_normalized = normalized_scores[top_emotion]
        second_normalized = (
            normalized_scores[ranked[1][0]] if len(ranked) > 1 else 0.0
        )

        normalized_margin = top_normalized - second_normalized

        # A meaningful signal requires both enough raw aggregated
        # probability mass and enough separation from the runner up.
        # When either is missing, we still return the top category
        # (to preserve the six-label contract for anything calling
        # this method directly) but flag it as ambiguous so the
        # caller (select_final_emotion) can distinguish a genuinely
        # strong fallback signal from a weak/neutral one.
        fallback_was_ambiguous = (
            top_raw_score < self.FALLBACK_MIN_SIGNAL_THRESHOLD
            or normalized_margin < self.FALLBACK_MIN_MARGIN
        )

        top_goemotions_emotions = [
            {"emotion": emotion, "score": score} for emotion, score in ranked[:3]
        ]

        return {
            "emotion": top_emotion,
            "confidence": float(top_normalized),
            "source": "goemotions_fallback",
            "scores": fallback_scores,
            "top_goemotions_emotions": top_goemotions_emotions,
            "fallback_was_ambiguous": fallback_was_ambiguous,
        }

    # =============================================================
    # FINAL EMOTION SELECTION (NEW — see class docstring)
    # =============================================================

    def select_final_emotion(self, primary_emotion, goemotions_probabilities):
        """
        Decide the single final emotion for the response.

        This is the ONLY place the final emotion is decided, and it
        is a pure function of its two inputs (no I/O, no model
        calls) so it can be unit-tested directly against the real
        production logic without loading either trained model (see
        test_predictor_emotion_selection.py).

        Why this exists (see class docstring for the full
        rationale): the primary 6-class model is a forced-choice
        softmax with no neutral/low-intensity option, so its
        confidence can be very high on inputs that don't genuinely
        belong to any of its six categories. Lowering
        PRIMARY_CONFIDENCE_THRESHOLD / PRIMARY_MARGIN_THRESHOLD
        cannot fix this: the model will still confidently pick
        *something* from its six options no matter how those two
        knobs are tuned, because it has no other option to pick.
        Instead we require independent corroboration from GoEmotions
        before trusting the primary model's pick, regardless of how
        confident that pick is:

          1. needs_goemotions_fallback (existing signal): the
             primary model's OWN confidence/margin was already weak.
          2. six_class_coverage_is_low: GoEmotions assigns very
             little combined probability mass to ANY of the six
             categories -- the input is likely dominated by
             neutral/mild GoEmotions labels the six-class schema has
             no slot for (e.g. "approval", "neutral", "realization").
          3. primary_uncorroborated: GoEmotions assigns very little
             mass specifically to the category the primary model
             picked, even if overall six-class coverage is decent
             (i.e. GoEmotions supports a DIFFERENT category).

        If none of the three trigger, the primary model's pick is
        used as-is -- this preserves genuinely strong six-class
        predictions (clearly joyful/sad/angry/fearful/loving/
        surprised text keeps working exactly as before).

        If any of them trigger, we defer to GoEmotions:
          - If GoEmotions' own mapped category is itself strong and
            unambiguous (see select_goemotions_emotion), use that
            six-class category (source = "goemotions_fallback").
          - Otherwise -- GoEmotions doesn't clearly support any of
            the six categories either (the "i am ok" case) -- the
            result is genuinely low-intensity/neutral. We return the
            sentinel emotion "neutral", intentionally OUTSIDE the six
            supported labels (source = "neutral_low_intensity").

        Returns a dict containing the final emotion plus full
        diagnostic metadata (primary_model_prediction,
        primary_model_confidence, primary_model_margin,
        primary_model_was_ambiguous, primary_model_was_low_confidence,
        six_class_coverage, primary_category_support, source,
        fallback_reason, ...).
        """

        fallback_scores = self.calculate_goemotions_fallback_scores(
            goemotions_probabilities
        )

        six_class_coverage = sum(fallback_scores.values())

        primary_category = primary_emotion["emotion"]

        primary_category_support = fallback_scores.get(
            primary_category,
            0.0
        )

        # ---------------------------------------------------------
        # FIND THE STRONGEST GOEMOTIONS-DERIVED SIX-CLASS CATEGORY
        # ---------------------------------------------------------

        ranked_fallback = sorted(
            fallback_scores.items(),
            key=lambda item: item[1],
            reverse=True,
        )

        goemotions_top_category = ranked_fallback[0][0]
        goemotions_top_score = ranked_fallback[0][1]

        goemotions_second_score = (
            ranked_fallback[1][1]
            if len(ranked_fallback) > 1
            else 0.0
        )

        goemotions_top_margin = (
            goemotions_top_score - goemotions_second_score
        )

        # ---------------------------------------------------------
        # DETERMINE WHETHER GOEMOTIONS DISAGREES WITH PRIMARY
        # ---------------------------------------------------------

        goemotions_supports_different_category = (
            goemotions_top_category != primary_category
            and goemotions_top_score >= self.GOEMOTIONS_OVERRIDE_MIN_SIGNAL
            and (
                goemotions_top_score - primary_category_support
                >= self.GOEMOTIONS_OVERRIDE_MARGIN
            )
        )

        six_class_coverage_is_low = (
            six_class_coverage < self.SIX_CLASS_COVERAGE_THRESHOLD
        )

        primary_uncorroborated = (
            primary_category_support < self.PRIMARY_COROBORATION_THRESHOLD
        )

        needs_reconsideration = (
            primary_emotion["needs_goemotions_fallback"]
            or six_class_coverage_is_low
            or primary_uncorroborated
            or goemotions_supports_different_category
        )

        diagnostics = {
            "primary_model_prediction": primary_emotion["emotion"],
            "primary_model_confidence": primary_emotion["confidence"],
            "primary_model_margin": primary_emotion["margin"],
            "primary_model_was_ambiguous": primary_emotion["is_ambiguous"],
            "primary_model_was_low_confidence": primary_emotion["is_low_confidence"],
            "top_emotions": primary_emotion["top_emotions"],
            "six_class_coverage": six_class_coverage,
            "six_class_coverage_is_low": six_class_coverage_is_low,
            "primary_category_support": primary_category_support,
            "primary_uncorroborated": primary_uncorroborated,
            "goemotions_top_category": goemotions_top_category,
            "goemotions_top_score": goemotions_top_score,
            "goemotions_second_score": goemotions_second_score,
            "goemotions_top_margin": goemotions_top_margin,
            "goemotions_supports_different_category": goemotions_supports_different_category,
            "fallback_scores": fallback_scores,
        }

        # ---------------------------------------------------------
        # PATH 1: primary model trusted as-is (strong, corroborated)
        # ---------------------------------------------------------
        if not needs_reconsideration:
            return {
                "emotion": primary_emotion["emotion"],
                "confidence": primary_emotion["confidence"],
                "source": "primary_model",
                "fallback_reason": None,
                "fallback_was_ambiguous": False,
                "top_goemotions_emotions": None,
                **diagnostics,
            }

        # ---------------------------------------------------------
        # PATH 2 / 3: defer to GoEmotions
        # ---------------------------------------------------------
        goemotions_emotion = self.select_goemotions_emotion(goemotions_probabilities)

        if primary_emotion["is_low_confidence"] and primary_emotion["is_ambiguous"]:
            fallback_reason = "low_confidence_and_ambiguous_margin"
        elif primary_emotion["is_low_confidence"]:
            fallback_reason = "low_confidence"
        elif primary_emotion["is_ambiguous"]:
            fallback_reason = "ambiguous_margin"
        elif six_class_coverage_is_low:
            fallback_reason = "low_six_class_coverage"
        elif goemotions_supports_different_category:
            fallback_reason = "goemotions_disagrees_with_primary"
        elif primary_uncorroborated:
            fallback_reason = "primary_uncorroborated_by_goemotions"
        else:
            fallback_reason = "primary_uncorroborated_by_goemotions"

        goemotions_supports_a_category = not goemotions_emotion["fallback_was_ambiguous"]

        if six_class_coverage_is_low or not goemotions_supports_a_category:
            # Neither the primary model's pick NOR GoEmotions' own
            # mapped fallback genuinely supports any of the six
            # categories. This is the "i am ok" case: return the
            # neutral sentinel instead of forcing an arbitrary
            # six-class label.
            return {
                "emotion": "neutral",
                "confidence": goemotions_probabilities.get("neutral", 0.0),
                "source": "neutral_low_intensity",
                "fallback_reason": fallback_reason,
                "fallback_was_ambiguous": True,
                "top_goemotions_emotions": goemotions_emotion["top_goemotions_emotions"],
                **diagnostics,
            }

        # GoEmotions clearly and independently supports one of the
        # six categories (possibly different from the primary
        # model's pick) -- use it.
        return {
            "emotion": goemotions_emotion["emotion"],
            "confidence": goemotions_emotion["confidence"],
            "source": "goemotions_fallback",
            "fallback_reason": fallback_reason,
            "fallback_was_ambiguous": goemotions_emotion["fallback_was_ambiguous"],
            "top_goemotions_emotions": goemotions_emotion["top_goemotions_emotions"],
            **diagnostics,
        }

    # =============================================================
    # ACTIVE GOEMOTIONS
    # =============================================================

    def get_active_emotions(self, probabilities):
        active = []

        for label, probability in probabilities.items():
            threshold = self.per_label_thresholds.get(label, self.global_threshold)

            if probability >= threshold:
                active.append({
                    "label": label,
                    "probability": probability,
                    "threshold": threshold,
                })

        active.sort(key=lambda x: x["probability"], reverse=True)

        return active

    # =============================================================
    # SENTIMENT (UNCHANGED)
    # =============================================================

    def calculate_sentiment(self, probabilities):
        positive_score = sum(
            probabilities.get(label, 0.0) for label in self.positive_emotions
        )
        negative_score = sum(
            probabilities.get(label, 0.0) for label in self.negative_emotions
        )
        neutral_score = sum(
            probabilities.get(label, 0.0) for label in self.neutral_emotions
        )

        total = positive_score + negative_score + neutral_score

        if total > 0:
            positive_score /= total
            negative_score /= total
            neutral_score /= total

        scores = {
            "positive": positive_score,
            "negative": negative_score,
            "neutral": neutral_score,
        }

        sentiment = max(scores, key=scores.get)

        return {"label": sentiment, "scores": scores}

    # =============================================================
    # RISK PATTERNS (UNCHANGED)
    # =============================================================

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

    # =============================================================
    # TEXT RISK DETECTION (UNCHANGED)
    # =============================================================

    def detect_risk_patterns(self, text):
        normalized_text = text.lower()
        detected = {}

        for category, patterns in self.RISK_PATTERNS.items():
            matches = []

            for pattern in patterns:
                if re.search(pattern, normalized_text, flags=re.IGNORECASE):
                    matches.append(pattern)

            if matches:
                detected[category] = matches

        return detected

    # =============================================================
    # PROTECTIVE SIGNALS (UNCHANGED)
    # =============================================================

    def detect_protective_patterns(self, text):
        normalized_text = text.lower()
        matches = []

        for pattern in self.PROTECTIVE_PATTERNS:
            if re.search(pattern, normalized_text, flags=re.IGNORECASE):
                matches.append(pattern)

        return matches

    # =============================================================
    # EMOTION RISK SCORE (UNCHANGED)
    # =============================================================

    def calculate_emotion_risk(self, probabilities):
        weights = self.risk_config.get("distress_emotion_weights", {})
        score = 0.0

        for emotion, weight in weights.items():
            probability = probabilities.get(emotion, 0.0)
            score += probability * weight

        return min(score, 1.0)

    # =============================================================
    # PROTECTIVE EMOTION SCORE (UNCHANGED)
    # =============================================================

    def calculate_protective_emotion_score(self, probabilities):
        weights = self.risk_config.get("protective_emotion_weights", {})
        score = 0.0

        for emotion, weight in weights.items():
            probability = probabilities.get(emotion, 0.0)
            score += probability * weight

        return min(score, 1.0)

    # =============================================================
    # TEXT RISK SCORE (UNCHANGED)
    # =============================================================

    def calculate_text_risk_score(self, detected_patterns):
        category_weights = self.risk_config.get("text_risk_pattern_categories", {})
        category_scores = {}

        for category, matches in detected_patterns.items():
            configured_values = category_weights.get(category, [])

            if not configured_values:
                category_scores[category] = 0.0
                continue

            match_count = len(matches)
            index = min(match_count - 1, len(configured_values) - 1)
            category_scores[category] = float(configured_values[index])

        if not category_scores:
            return 0.0, {}

        text_score = max(category_scores.values())

        return min(text_score, 1.0), category_scores

    # =============================================================
    # RISK LEVEL (UNCHANGED)
    # =============================================================

    def get_risk_level(self, score):
        thresholds = self.risk_config.get(
            "risk_thresholds", {"low": 0.25, "elevated": 0.50, "high": 0.75}
        )

        if score >= thresholds.get("high", 0.75):
            return "critical"

        if score >= thresholds.get("elevated", 0.50):
            return "high"

        if score >= thresholds.get("low", 0.25):
            return "elevated"

        return "low"

    # =============================================================
    # COMPLETE RISK ASSESSMENT (UNCHANGED)
    # =============================================================

    def calculate_risk_assessment(self, probabilities, text):
        detected_patterns = self.detect_risk_patterns(text)
        protective_patterns = self.detect_protective_patterns(text)

        emotion_score = self.calculate_emotion_risk(probabilities)
        protective_emotion_score = self.calculate_protective_emotion_score(
            probabilities
        )

        text_score, text_category_scores = self.calculate_text_risk_score(
            detected_patterns
        )

        # ---------------------------------------------------------
        # MODERATE EMOTIONAL DISTRESS SIGNAL
        # ---------------------------------------------------------
        fear_score = probabilities.get("fear", 0.0)
        nervousness_score = probabilities.get("nervousness", 0.0)

        moderate_distress_score = max(
            fear_score,
            nervousness_score
        )

        # Only treat substantial fear/nervousness as a
        # moderate-distress signal. This does NOT represent
        # a clinical assessment.
        if moderate_distress_score >= 0.50:
            text_score = max(text_score, 0.40)
            text_category_scores["moderate_emotional_distress"] = 0.40

        weights = self.risk_config.get("risk_weights", {})

        emotion_weight = weights.get("emotion_component", 0.35)
        text_weight = weights.get("text_component", 0.65)
        protective_weight = weights.get("protective_component", 0.25)

        raw_score = (
            emotion_score * emotion_weight
            + text_score * text_weight
            - protective_emotion_score * protective_weight
        )

        if protective_patterns:
            raw_score -= 0.05

        final_score = max(0.0, min(1.0, raw_score))
        risk_level = self.get_risk_level(final_score)

        return {
            "risk_score": final_score,
            "risk_level": risk_level,
            "emotion_component": emotion_score,
            "text_component": text_score,
            "protective_emotion_component": protective_emotion_score,
            "detected_risk_categories": list(detected_patterns.keys()),
            "text_risk_category_scores": text_category_scores,
            "protective_text_signals": len(protective_patterns),
            "risk_patterns": detected_patterns,
        }

    # =============================================================
    # DIAGNOSTIC LOGGING
    # =============================================================

    def _log_emotion_decision(self, text, final_emotion):
        """
        Temporary-style diagnostic logging (kept permanently, since
        it is cheap and directly answers "why did the app pick this
        emotion?" for any input, not just "i am ok"). Prints the
        primary prediction, its confidence/margin, the GoEmotions
        top labels considered, and the final decision + reason.
        """
        top_goemotions = final_emotion.get("top_goemotions_emotions")

        print(f"\n--- Emotion decision for: {text!r} ---")
        print(
            "Primary model prediction:", final_emotion["primary_model_prediction"],
            "| confidence:", round(final_emotion["primary_model_confidence"], 4),
            "| margin:", round(final_emotion["primary_model_margin"], 4),
            "| low_confidence:", final_emotion["primary_model_was_low_confidence"],
            "| ambiguous:", final_emotion["primary_model_was_ambiguous"],
        )
        print(
            "Six-class GoEmotions coverage:",
            round(final_emotion["six_class_coverage"], 4),
            f"(threshold {self.SIX_CLASS_COVERAGE_THRESHOLD})",
            "| support for primary's pick:",
            round(final_emotion["primary_category_support"], 4),
            f"(threshold {self.PRIMARY_COROBORATION_THRESHOLD})",
        )
        if top_goemotions:
            print("GoEmotions top mapped categories:", top_goemotions)
        print(
            "FINAL EMOTION:", final_emotion["emotion"],
            "| source:", final_emotion["source"],
            "| fallback_reason:", final_emotion["fallback_reason"],
        )
        print("---------------------------------------------\n")

    # =============================================================
    # UNIFIED ANALYSIS
    # =============================================================

    def analyze(self, text):
        if not isinstance(text, str):
            raise TypeError("text must be a string")

        text = text.strip()

        if not text:
            raise ValueError("text cannot be empty")

        # ---------------------------------------------------------
        # MODEL 1 — PRIMARY EMOTION
        # ---------------------------------------------------------
        primary_emotion = self.predict_primary_emotion(text)

        # ---------------------------------------------------------
        # MODEL 2 — GOEMOTIONS
        # ---------------------------------------------------------
        goemotions_probabilities = self.predict_goemotions(text)

        active_emotions = self.get_active_emotions(goemotions_probabilities)
        sentiment = self.calculate_sentiment(goemotions_probabilities)
        risk = self.calculate_risk_assessment(goemotions_probabilities, text)
        print("\n========== RISK ASSESSMENT ==========")
        print("Risk score:", round(risk["risk_score"], 4))
        print("Risk level:", risk["risk_level"])
        print("Emotion component:", round(risk["emotion_component"], 4))
        print("Text component:", round(risk["text_component"], 4))
        print("Protective emotion component:", round(risk["protective_emotion_component"], 4))
        print("Detected risk categories:", risk["detected_risk_categories"])
        print("Text risk category scores:", risk["text_risk_category_scores"])
        print("Protective text signals:", risk["protective_text_signals"])
        print("=====================================\n")

        # ---------------------------------------------------------
        # FINAL EMOTION SELECTION
        #
        # See select_final_emotion() docstring / class docstring for
        # the full rationale. In short: the primary model's pick is
        # trusted only when GoEmotions independently corroborates
        # it; otherwise GoEmotions decides (or, if GoEmotions itself
        # doesn't clearly support any of the six categories, the
        # result is the "neutral" sentinel).
        # ---------------------------------------------------------
        final_emotion = self.select_final_emotion(
            primary_emotion, goemotions_probabilities
        )
        print("\n========== FINAL PYTHON RESULT ==========")
        print("TEXT:", text)
        print("PRIMARY:", primary_emotion["emotion"])
        print("PRIMARY CONFIDENCE:", primary_emotion["confidence"])
        print("GOEMOTIONS APPROVAL:", goemotions_probabilities.get("approval"))
        print("GOEMOTIONS NEUTRAL:", goemotions_probabilities.get("neutral"))
        print("GOEMOTIONS OPTIMISM:", goemotions_probabilities.get("optimism"))
        print("GOEMOTIONS CARING:", goemotions_probabilities.get("caring"))
        print("FINAL EMOTION:", final_emotion["emotion"])
        print("FINAL CONFIDENCE:", final_emotion["confidence"])
        print("FINAL SOURCE:", final_emotion["source"])
        print("FALLBACK REASON:", final_emotion["fallback_reason"])
        print("==========================================\n")
        self._log_emotion_decision(text, final_emotion)

        # ---------------------------------------------------------
        # FINAL RESULT
        # ---------------------------------------------------------
        return {
            "text": text,
            "emotion": final_emotion,
            "sentiment": sentiment,
            "goemotions": {
                "active_emotions": active_emotions,
                "probabilities": goemotions_probabilities,
            },
            "risk": risk,
        }


if __name__ == "__main__":
    # Manual verification entry point (requirement #16): running this
    # file directly loads both real trained models and prints the
    # full before/after-style decision trace for "i am ok", plus a
    # couple of comparison sentences. This requires the actual model
    # directories under base_dir/models/ to be present -- it is NOT
    # part of the automated test suite (see
    # test_predictor_emotion_selection.py for that, which does not
    # require the model weights).
    predictor = MentalHealthPredictor()

    for sample_text in [
        "i am ok",
        "I'm absolutely thrilled and overjoyed today!",
        "I feel so hopeless and sad, nothing is going right.",
    ]:
        result = predictor.analyze(sample_text)
        print(json.dumps(result["emotion"], indent=2, default=str))