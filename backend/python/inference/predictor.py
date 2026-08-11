import json
import re
from pathlib import Path

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


class MentalHealthPredictor:
    """
    Unified inference layer built around a single trained model:
    GoEmotions (28-label, multi-label / sigmoid).

    ARCHITECTURE (GoEmotions-only)
    -------------------------------------------------------------
        Journal text
            |
            v
         GoEmotions
            |
      +-----+------+-------------+
      |            |             |
      v            v             v
    emotion     sentiment       risk

      |
      v

    dominant emotion + secondary/supporting emotions

    HISTORY / WHY THE 6-CLASS MODEL WAS REMOVED
    -------------------------------------------------------------
    This predictor previously also loaded a separate 6-class
    "primary" emotion model and ran a multi-step arbitration
    process on every request. That architecture has been removed
    entirely. GoEmotions (28-label, multi-label) is the SOLE source
    of emotion detection. It also continues to independently power
    sentiment and risk analysis, exactly as before -- risk is a
    separate analysis layer and is never simply equated with
    emotion (see calculate_risk_assessment()).

    RISK SCREENING -- WHAT IT IS AND IS NOT
    -------------------------------------------------------------
    calculate_risk_assessment() is a HEURISTIC SCREENING signal,
    combining:
      - regex-based text pattern detection (suicidal ideation,
        self-harm, hopelessness, feeling trapped, severe distress),
      - GoEmotions-derived distress/protective emotion weighting,
      - simple protective-language detection.

    It is NOT a clinical assessment, it does NOT diagnose any
    condition, and it must never be presented to the user as such.
    All UI copy referencing this feature should say things like
    "risk screening" / "heuristic screening indicator" / "not a
    clinical assessment" -- never "you are suicidal" or "you have
    depression".

    Risk is fully separate from emotion: a journal entry can carry
    strong fear/nervousness signals and still score LOW risk,
    because risk is computed from its own emotion weighting + text
    pattern detection + protective signals, not from the dominant
    emotion label.
    """

    MAX_LENGTH = 128

    # -------------------------------------------------------------
    # EMOTION RESOLUTION THRESHOLDS
    # -------------------------------------------------------------
    # Starting values only -- NOT scientifically validated. Tune
    # against real journal data / threshold_config.json before
    # relying on these in production.

    DOMINANT_EMOTION_MIN = 0.15
    SECONDARY_EMOTION_THRESHOLD = 0.10
    MAX_SECONDARY_EMOTIONS = 4

    # -------------------------------------------------------------
    # LONG-ENTRY EMOTION AGGREGATION
    # -------------------------------------------------------------
    # A journal entry at or above this many words is treated as
    # "long": instead of a single GoEmotions pass over the whole
    # entry (which effectively only "sees" the first MAX_LENGTH
    # tokens and collapses everything into one dominant emotion),
    # the entry is split into sentence-aware chunks, each chunk is
    # run through the SAME predict_goemotions() call, and the
    # per-chunk results are aggregated (see
    # aggregate_chunk_probabilities()) before dominant/secondary
    # resolution. Entries below this threshold keep the exact
    # single-pass behavior that existed before this change -- no
    # extra model calls, no behavior change for short entries.
    LONG_ENTRY_WORD_THRESHOLD = 40

    # Target words per chunk when grouping sentences together.
    # Chosen to comfortably fit under MAX_LENGTH (128 tokens) for
    # ordinary journal-style sentences, while keeping the number of
    # chunks (and therefore model calls) per entry reasonable.
    CHUNK_WORD_TARGET = 40

    # Hard cap on the number of chunks analyzed per entry, so a
    # single very long journal entry can't trigger an unbounded
    # number of model calls. Sentences are grouped to stay under
    # this cap wherever possible (see _build_emotion_chunks).
    MAX_EMOTION_CHUNKS = 12

    def __init__(self, base_dir=None):
        # ---------------------------------------------------------
        # PATHS
        # ---------------------------------------------------------

        if base_dir is None:
            base_dir = Path(__file__).resolve().parent.parent

        self.base_dir = Path(base_dir)

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

        self.has_neutral_label = "neutral" in self.label2id

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
        # LOAD MODEL -- GOEMOTIONS (the only model loaded)
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

        print("GoEmotions model loaded successfully.")
        print(
            "Emotion resolution thresholds -- DOMINANT_EMOTION_MIN:",
            self.DOMINANT_EMOTION_MIN,
            "| SECONDARY_EMOTION_THRESHOLD:",
            self.SECONDARY_EMOTION_THRESHOLD,
            "| has_neutral_label:",
            self.has_neutral_label,
        )

    # =============================================================
    # UTILITY
    # =============================================================

    @staticmethod
    def _load_json(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    # =============================================================
    # GOEMOTIONS INFERENCE
    # =============================================================

    def predict_goemotions(self, text):
        """
        Run GoEmotions multi-label prediction. Sigmoid is used
        because GoEmotions is treated as a multi-label classifier
        here (each label's probability is independent of the
        others, unlike a softmax).
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
    # EMOTION RESOLUTION (dominant + secondary, GoEmotions-only)
    # =============================================================

    def get_dominant_and_secondary_emotions(self, probabilities):
        """
        Resolve the dominant emotion and up to MAX_SECONDARY_EMOTIONS
        secondary/supporting emotions directly from raw GoEmotions
        probabilities. GoEmotions labels are never collapsed or
        mapped into any fixed schema.
        """

        if not probabilities:
            return (
                {
                    "label": "neutral",
                    "probability": None,
                    "source": "goemotions_neutral_fallback",
                },
                [],
            )

        ranked = sorted(
            probabilities.items(), key=lambda item: item[1], reverse=True
        )
        top_label, top_score = ranked[0]

        if top_score >= self.DOMINANT_EMOTION_MIN:
            dominant = {
                "label": top_label,
                "probability": float(top_score),
                "source": "goemotions",
            }
        elif self.has_neutral_label:
            dominant = {
                "label": "neutral",
                "probability": float(probabilities.get("neutral", 0.0)),
                "source": "goemotions",
            }
        else:
            dominant = {
                "label": "neutral",
                "probability": None,
                "source": "goemotions_neutral_fallback",
            }

        secondary = []
        for label, score in ranked:
            if label == dominant["label"]:
                continue
            if label == "neutral":
                continue
            if score < self.SECONDARY_EMOTION_THRESHOLD:
                break
            secondary.append({"label": label, "probability": float(score)})
            if len(secondary) >= self.MAX_SECONDARY_EMOTIONS:
                break

        return dominant, secondary

    # =============================================================
    # ACTIVE GOEMOTIONS (per-label threshold view, unchanged)
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
    # LONG-ENTRY EMOTION SEGMENTATION + AGGREGATION
    # -------------------------------------------------------------
    # This is additive to the single-pass GoEmotions flow above --
    # it does not change predict_goemotions(), the dominant/
    # secondary resolution logic, or how risk/sentiment are
    # computed. It only decides WHAT probabilities get fed into
    # get_dominant_and_secondary_emotions() for long entries.
    # =============================================================

    @staticmethod
    def _split_into_sentences(text):
        """
        Sentence-aware splitter used to build emotion-analysis
        chunks. Kept separate from the risk pipeline's own
        _split_sentences() so this can evolve independently without
        any chance of affecting risk-pattern scoping.
        """
        pieces = re.split(r"(?<=[.!?])\s+", text.strip())
        pieces = [p.strip() for p in pieces if p.strip()]
        return pieces

    def _build_emotion_chunks(self, text):
        """
        Group the entry into sentence-aware chunks of roughly
        CHUNK_WORD_TARGET words each, so each chunk stays well
        under the model's MAX_LENGTH token budget and the total
        number of chunks stays within MAX_EMOTION_CHUNKS.

        - Sentences are never split apart to hit a target -- chunks
          are built by accumulating whole sentences until adding
          another would exceed the word target, then starting a
          new chunk.
        - The one exception is a single "sentence" that is itself
          longer than the target (e.g. a run-on line with no
          punctuation) -- that is chunked by word count as a
          fallback so it still fits the model's input window
          instead of being silently truncated.
        """
        sentences = self._split_into_sentences(text)
        if not sentences:
            return [text] if text else []

        chunks = []
        current_words = []

        def flush():
            if current_words:
                chunks.append(" ".join(current_words))

        for sentence in sentences:
            words = sentence.split()

            # Fallback: an over-long "sentence" (no punctuation to
            # split on) is chunked by word count on its own so it
            # doesn't blow past the model's input window.
            if len(words) > self.CHUNK_WORD_TARGET * 1.5:
                flush()
                current_words = []
                for i in range(0, len(words), self.CHUNK_WORD_TARGET):
                    chunks.append(" ".join(words[i:i + self.CHUNK_WORD_TARGET]))
                continue

            if current_words and (
                len(current_words) + len(words) > self.CHUNK_WORD_TARGET
            ):
                flush()
                current_words = []

            current_words.extend(words)

        flush()

        # Respect the hard cap on chunk count. If sentence-aware
        # grouping still produced too many chunks (very long entry),
        # merge adjacent chunks pairwise until under the cap rather
        # than dropping any content.
        while len(chunks) > self.MAX_EMOTION_CHUNKS:
            merged = []
            for i in range(0, len(chunks), 2):
                if i + 1 < len(chunks):
                    merged.append(chunks[i] + " " + chunks[i + 1])
                else:
                    merged.append(chunks[i])
            chunks = merged

        return chunks

    def aggregate_chunk_probabilities(self, chunk_probability_dicts):
        """
        Combine per-chunk GoEmotions probability dicts into a single
        aggregated probability profile for the whole entry.

        METHOD (transparent, documented on purpose):
        For each label, three signals are computed across all
        chunks and blended:

          - mean_prob:      average probability for that label
                             across every chunk -- rewards emotions
                             that show up consistently.
          - max_prob:        the single highest probability seen for
                             that label in any one chunk -- rewards
                             emotions that appear strongly even if
                             only briefly (e.g. one sharp moment of
                             anger in an otherwise calm entry).
          - presence_ratio:  fraction of chunks where the label
                             cleared SECONDARY_EMOTION_THRESHOLD --
                             rewards emotions that recur across the
                             entry rather than appearing once.

        aggregated_score = 0.5 * mean_prob + 0.3 * max_prob + 0.2 * presence_ratio

        This intentionally does NOT simply take the single highest
        probability from any one chunk -- that would just reproduce
        the original "one dominant emotion" problem at chunk
        granularity instead of paragraph granularity.
        """
        if not chunk_probability_dicts:
            return {}

        num_chunks = len(chunk_probability_dicts)
        all_labels = chunk_probability_dicts[0].keys()

        aggregated = {}
        for label in all_labels:
            values = [chunk.get(label, 0.0) for chunk in chunk_probability_dicts]
            mean_prob = sum(values) / num_chunks
            max_prob = max(values)
            presence_ratio = sum(
                1 for v in values if v >= self.SECONDARY_EMOTION_THRESHOLD
            ) / num_chunks

            aggregated[label] = (
                0.5 * mean_prob + 0.3 * max_prob + 0.2 * presence_ratio
            )

        return aggregated

    def predict_goemotions_aggregated(self, text, raw_probabilities):
        """
        Decide whether `text` needs long-entry chunk aggregation and
        return (probabilities_for_emotion_resolution, meta).

        Short entries (< LONG_ENTRY_WORD_THRESHOLD words) reuse
        `raw_probabilities` -- the SAME single-pass result already
        computed in analyze() -- so short entries make no extra
        model calls and behave exactly as before this change.

        Long entries are segmented via _build_emotion_chunks(), each
        chunk is run through the existing predict_goemotions(), and
        the results are combined with aggregate_chunk_probabilities().
        """
        word_count = len(text.split())

        if word_count < self.LONG_ENTRY_WORD_THRESHOLD:
            return raw_probabilities, {
                "is_long_entry": False,
                "chunk_count": 1,
                "chunks": None,
            }

        chunks = self._build_emotion_chunks(text)

        if len(chunks) <= 1:
            # Segmentation didn't actually produce multiple chunks
            # (e.g. one giant run-on sentence just under the cap) --
            # no benefit to aggregating a single chunk against
            # itself, so just reuse the raw single-pass result.
            return raw_probabilities, {
                "is_long_entry": False,
                "chunk_count": 1,
                "chunks": None,
            }

        chunk_probability_dicts = [self.predict_goemotions(chunk) for chunk in chunks]
        aggregated_probabilities = self.aggregate_chunk_probabilities(
            chunk_probability_dicts
        )

        # Per-chunk dominant label, kept for debug logging only --
        # never surfaced to the production UI.
        chunk_summaries = []
        for chunk_text, chunk_probs in zip(chunks, chunk_probability_dicts):
            top_label, top_score = max(chunk_probs.items(), key=lambda kv: kv[1])
            chunk_summaries.append({
                "text": chunk_text,
                "top_label": top_label,
                "top_score": round(top_score, 4),
            })

        return aggregated_probabilities, {
            "is_long_entry": True,
            "chunk_count": len(chunks),
            "chunks": chunk_summaries,
        }

    # =============================================================
    # OVERALL EMOTIONAL REFLECTION (deterministic, template-based)
    # -------------------------------------------------------------
    # No LLM/generative integration currently exists in this
    # project's inference layer, so this is a deterministic,
    # template-based summary built directly from the actual
    # detected dominant/secondary emotions -- never a hardcoded
    # example, never inventing emotions that weren't detected, and
    # never phrased as a diagnosis or clinical claim. If an LLM
    # integration is added to this project later, it can replace
    # the templating below with a generated summary using this same
    # dominant/secondary input -- the calling shape (analyze()
    # returning a `reflection.summary` string) would not need to
    # change.
    # =============================================================

    def generate_emotional_reflection(self, dominant_emotion, secondary_emotions):
        dominant_label = dominant_emotion.get("label") or "neutral"

        if dominant_label == "neutral" and not secondary_emotions:
            return "Your entry reads as fairly even in tone, without one emotion clearly standing out."

        secondary_labels = [item["label"] for item in secondary_emotions]

        positive_labels = [
            l for l in [dominant_label] + secondary_labels
            if l in self.positive_emotions
        ]
        negative_labels = [
            l for l in [dominant_label] + secondary_labels
            if l in self.negative_emotions
        ]

        # De-duplicate while preserving first-seen order (dominant
        # emotion first, then secondary emotions in their existing
        # rank order).
        def dedupe(items):
            seen = set()
            ordered = []
            for item in items:
                if item not in seen:
                    seen.add(item)
                    ordered.append(item)
            return ordered

        positive_labels = dedupe(positive_labels)
        negative_labels = dedupe(negative_labels)

        # Only a single detected emotion (typical for short entries)
        # -- keep this to one plain sentence rather than forcing the
        # two-part "mix of X, despite Y" template below.
        if not secondary_labels:
            return f"Your entry mainly reflects a sense of {dominant_label}."

        lead_labels = dedupe([dominant_label] + secondary_labels[:2])
        lead_text = self._join_labels(lead_labels)

        if positive_labels and negative_labels:
            other_negative = [l for l in negative_labels if l not in lead_labels]
            other_positive = [l for l in positive_labels if l not in lead_labels]
            contrast_labels = dedupe(other_negative + other_positive) or dedupe(
                negative_labels + positive_labels
            )
            contrast_labels = [l for l in contrast_labels if l not in lead_labels] or contrast_labels
            contrast_text = self._join_labels(contrast_labels[:3])

            return (
                f"Your entry reflects a mix of {lead_text}, alongside moments of "
                f"{contrast_text}. Both the harder and the more hopeful feelings "
                f"come through across the entry."
            )

        # All-positive or all-negative (or neutral-heavy) entries --
        # single-tone summary, still built only from detected labels.
        remaining = [l for l in dedupe([dominant_label] + secondary_labels) if l not in lead_labels]
        if remaining:
            remaining_text = self._join_labels(remaining[:2])
            return (
                f"Your entry reflects a mix of {lead_text}, along with touches of "
                f"{remaining_text} running through it."
            )

        return f"Your entry reflects a mix of {lead_text} running through it."

    @staticmethod
    def _join_labels(labels):
        """'joy' / 'joy and hope' / 'joy, hope, and pride'"""
        if not labels:
            return ""
        if len(labels) == 1:
            return labels[0]
        if len(labels) == 2:
            return f"{labels[0]} and {labels[1]}"
        return f"{', '.join(labels[:-1])}, and {labels[-1]}"

    # =============================================================
    # SENTIMENT (UNCHANGED -- separate from emotion)
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
    # RISK PATTERNS
    # -------------------------------------------------------------
    # These are intentionally-broadened but still reasonably precise
    # regexes -- not an exhaustive keyword dump. Each pattern is a
    # phrase-level match (word-boundary anchored) rather than a
    # single loose keyword, to keep the false-positive rate down.
    #
    # NOTE ON "(don't|do not) want to live/be alive" style patterns:
    # the negation word here is semantically part of the risk
    # statement itself (the person IS expressing they don't want to
    # live), so these patterns intentionally include the negation
    # word inside the match. The generic negation suppression below
    # only looks at words BEFORE a match, so these are unaffected by
    # it (see _is_negated).
    # =============================================================

    RISK_PATTERNS = {
        "suicidal_ideation": [
            r"\bkill(ing)? myself\b",
            r"\bmight kill myself\b",
            r"\bend my life\b",
            r"\bend it all\b",
            r"\bdon'?t want to live(?: anymore)?\b",
            r"\bdo not want to live(?: anymore)?\b",
            r"\bdon'?t want to be alive\b",
            r"\bdo not want to be alive\b",
            r"\bwant(?:s|ed)? to die\b",
            r"\bwish i were dead\b",
            r"\bwish i was dead\b",
            r"\bsuicid(?:e|al)\b",
            r"\bthinking about suicide\b",
            r"\bthoughts? of suicide\b",
            r"\bwant to end my life\b",
            r"\bno point in living\b",
            r"\bno point living\b",
            r"\blife (?:isn'?t|is not) worth living\b",
            r"\bnot worth living\b",
            r"\bcan'?t go on\b",
            r"\bcan'?t do this anymore\b",
            r"\bcannot do this anymore\b",
        ],

        "self_harm": [
            r"\bhurt(?:ing)? myself\b",
            r"\bharm(?:ing)? myself\b",
            r"\bself[- ]harm(?:ing)?\b",
            r"\bself[- ]injur(?:y|e|ing)\b",
            r"\bcut(?:ting)? myself\b",
            r"\bbeen self[- ]harming\b",
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
            r"\bcan'?t escape\b",
            r"\bcannot escape\b",
            r"\bno way out\b",
            r"\bnowhere to go\b",
            r"\bnowhere to turn\b",
        ],

        "severe_distress": [
            r"\bcompletely overwhelmed\b",
            r"\bcan'?t cope\b",
            r"\bcannot cope\b",
            r"\bbreaking down\b",
            r"\bfalling apart\b",
            r"\bcan'?t take this anymore\b",
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

    # -------------------------------------------------------------
    # CONTEXT HANDLING -- NEGATION / THIRD-PARTY (lightweight)
    # -------------------------------------------------------------
    # LIMITATION: this is plain regex/keyword heuristics, not real
    # NLP. It will not catch every negation or reported-speech
    # construction, and it can still be fooled by unusual phrasing
    # (double negatives, sarcasm, negation several clauses away,
    # etc). It is a best-effort reduction of the most common false
    # positives ("I'm not suicidal", "my friend said he wanted to
    # die"), not a guarantee of correct context understanding.
    # -------------------------------------------------------------

    NEGATION_CUE_PATTERN = re.compile(
        r"\b(not|never|no longer|isn'?t|aren'?t|wasn'?t|weren'?t|"
        r"don'?t|doesn'?t|didn'?t|won'?t|wouldn'?t|can'?t say)\b",
        flags=re.IGNORECASE,
    )

    # How many characters before a match to scan for a negation cue.
    NEGATION_WINDOW_CHARS = 40

    FIRST_PERSON_PATTERN = re.compile(
        r"\b(i|i'm|i've|i'll|i'd)\b", flags=re.IGNORECASE
    )

    THIRD_PARTY_CUE_PATTERN = re.compile(
        r"\b(my friend|a friend|he|she|him|her|they|them|someone|"
        r"my brother|my sister|my mom|my dad|my coworker|my colleague)\b",
        flags=re.IGNORECASE,
    )

    @staticmethod
    def _split_sentences(text):
        """
        Very small sentence splitter used only to scope negation /
        third-party checks to the clause the match actually occurs
        in, rather than the whole journal entry. Not linguistically
        rigorous -- good enough for this heuristic screening layer.
        """
        pieces = re.split(r"(?<=[.!?])\s+", text.strip())
        return [p for p in pieces if p]

    def _is_negated(self, sentence, match_start):
        """
        Returns True if a negation cue appears shortly before the
        match within the same sentence. This intentionally only
        looks at the text BEFORE the match, so patterns that already
        bake a negation word into the phrase itself (e.g. "don't
        want to live") are unaffected -- that negation is part of
        the match span, not the preceding window.
        """
        window_start = max(0, match_start - self.NEGATION_WINDOW_CHARS)
        window = sentence[window_start:match_start]
        return bool(self.NEGATION_CUE_PATTERN.search(window))

    def _is_third_party(self, sentence):
        """
        Returns True when a sentence appears to describe someone
        else's experience (e.g. "my friend said he wanted to die")
        rather than the journal author's own -- i.e. no first-person
        pronoun is present but a third-party cue is. Deliberately
        conservative: if a first-person pronoun is anywhere in the
        sentence, we do NOT treat it as third-party, since journal
        entries often mix "I" with references to other people.
        """
        if self.FIRST_PERSON_PATTERN.search(sentence):
            return False
        return bool(self.THIRD_PARTY_CUE_PATTERN.search(sentence))

    # =============================================================
    # TEXT RISK DETECTION
    # -------------------------------------------------------------
    # Scans sentence-by-sentence so negation/third-party context
    # checks are scoped correctly. Returns (detected, third_party)
    # where `detected` has the same shape as before (category ->
    # list of matched pattern strings) and `third_party` is a list
    # of {category, pattern} entries that matched textually but were
    # suppressed because they looked like a third-party mention --
    # kept only for transparency/debugging, never used in scoring.
    # =============================================================

    def detect_risk_patterns(self, text):
        normalized_text = text.lower()
        sentences = self._split_sentences(normalized_text)

        detected = {}
        third_party = []

        for category, patterns in self.RISK_PATTERNS.items():
            matches = []

            for sentence in sentences:
                third_party_sentence = self._is_third_party(sentence)

                for pattern in patterns:
                    for match in re.finditer(pattern, sentence, flags=re.IGNORECASE):
                        if self._is_negated(sentence, match.start()):
                            continue

                        if third_party_sentence:
                            third_party.append({
                                "category": category,
                                "pattern": pattern,
                            })
                            continue

                        matches.append(pattern)

            if matches:
                detected[category] = matches

        return detected, third_party

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
    # TEXT RISK SCORE (UNCHANGED -- still driven by risk_config.json)
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
    # COMPLETE RISK ASSESSMENT
    # -------------------------------------------------------------
    # Risk remains a fully separate analysis layer from emotion --
    # it is never derived by simply equating an emotion label with
    # elevated risk. This is a HEURISTIC SCREENING signal only, not
    # a clinical assessment, and must be presented to users as such.
    # =============================================================

    def calculate_risk_assessment(self, probabilities, text):
        detected_patterns, third_party_mentions = self.detect_risk_patterns(text)
        protective_patterns = self.detect_protective_patterns(text)

        emotion_score = self.calculate_emotion_risk(probabilities)
        protective_emotion_score = self.calculate_protective_emotion_score(
            probabilities
        )

        text_score, text_category_scores = self.calculate_text_risk_score(
            detected_patterns
        )

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
            # Transparency-only field: text that matched a risk phrase
            # but was suppressed from scoring because it looked like
            # it was describing someone else (see _is_third_party).
            # Never surfaced in the UI, kept for debugging/audit.
            "third_party_mentions": third_party_mentions,
            # Explicit, stable disclaimer field so any consumer of
            # this object (Node, frontend, logs) can quote it directly
            # instead of re-writing disclaimer copy in multiple places.
            "disclaimer": (
                "Heuristic screening indicator. Not a clinical "
                "assessment or diagnosis."
            ),
        }

    # =============================================================
    # DIAGNOSTIC LOGGING
    # =============================================================

    def _log_emotion_decision(self, text, dominant, secondary):
        secondary_display = [
            f"{item['label']}={round(item['probability'], 4)}"
            for item in secondary
        ]

        probability_display = (
            round(dominant["probability"], 4)
            if dominant["probability"] is not None
            else None
        )

        print(f"\n--- Emotion decision for: {text!r} ---")
        print(
            "Dominant:", dominant["label"],
            "| probability:", probability_display,
            "| source:", dominant["source"],
        )
        print("Secondary:", secondary_display if secondary_display else "(none)")
        print("---------------------------------------------\n")

    def _log_aggregation_decision(self, meta):
        """
        Debug-only logging for the long-entry aggregation path --
        mirrors the style of _log_emotion_decision/_log_risk_decision
        so it's easy to see, during development, whether an entry
        was treated as long, how many chunks it produced, and what
        each chunk's own top emotion was before aggregation.
        """
        if not meta.get("is_long_entry"):
            print("--- Emotion aggregation: entry treated as SHORT (single pass) ---\n")
            return

        print(f"\n--- Emotion aggregation: entry treated as LONG ({meta['chunk_count']} chunks) ---")
        for i, chunk in enumerate(meta.get("chunks") or [], start=1):
            preview = chunk["text"][:60] + ("..." if len(chunk["text"]) > 60 else "")
            print(f"  chunk {i}: top={chunk['top_label']} ({chunk['top_score']}) | {preview!r}")
        print("---------------------------------------------\n")

    def _log_risk_decision(self, text, risk):
        """
        Lightweight diagnostic logging for the risk pipeline --
        mirrors _log_emotion_decision so "why did this get flagged?"
        is just as answerable for risk as it is for emotion.
        """
        print(f"\n--- Risk decision for: {text!r} ---")
        print(
            "Level:", risk["risk_level"],
            "| score:", round(risk["risk_score"], 4),
            "| categories:", risk["detected_risk_categories"],
            "| protective_signals:", risk["protective_text_signals"],
        )
        if risk["third_party_mentions"]:
            print("Suppressed third-party mentions:", risk["third_party_mentions"])
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
        # GOEMOTIONS -- single raw pass over the full entry text.
        # This is EXACTLY the same call/behavior that existed before
        # the long-entry aggregation change, and continues to be
        # what powers SENTIMENT and RISK below unchanged.
        # ---------------------------------------------------------
        raw_probabilities = self.predict_goemotions(text)

        # ---------------------------------------------------------
        # EMOTION RESOLUTION -- long-entry aware.
        #
        # Short entries (< LONG_ENTRY_WORD_THRESHOLD words) reuse
        # raw_probabilities directly -- no extra model calls, same
        # dominant/secondary resolution as before this change.
        #
        # Longer entries are segmented into sentence-aware chunks,
        # each chunk analyzed with the SAME predict_goemotions(),
        # then aggregated (aggregate_chunk_probabilities()) into one
        # probability profile BEFORE dominant/secondary resolution,
        # so a long entry isn't reduced to whichever single emotion
        # happened to score highest overall.
        # ---------------------------------------------------------
        emotion_probabilities, aggregation_meta = self.predict_goemotions_aggregated(
            text, raw_probabilities
        )

        dominant_emotion, secondary_emotions = (
            self.get_dominant_and_secondary_emotions(emotion_probabilities)
        )
        active_emotions = self.get_active_emotions(emotion_probabilities)

        # ---------------------------------------------------------
        # SENTIMENT -- separate analysis layer, UNCHANGED: still
        # derived from the single raw pass, exactly as before.
        # ---------------------------------------------------------
        sentiment = self.calculate_sentiment(raw_probabilities)

        # ---------------------------------------------------------
        # RISK -- separate screening layer, UNCHANGED. Still
        # computed from raw_probabilities + the full original text,
        # never from the aggregated long-entry emotion profile. This
        # is the field Node/React must surface.
        # ---------------------------------------------------------
        risk = self.calculate_risk_assessment(raw_probabilities, text)

        # ---------------------------------------------------------
        # OVERALL REFLECTION -- short, deterministic, template-based
        # 2-3 line summary built only from the dominant/secondary
        # emotions actually detected above. See
        # generate_emotional_reflection() docstring.
        # ---------------------------------------------------------
        reflection_summary = self.generate_emotional_reflection(
            dominant_emotion, secondary_emotions
        )

        self._log_emotion_decision(text, dominant_emotion, secondary_emotions)
        self._log_aggregation_decision(aggregation_meta)
        self._log_risk_decision(text, risk)

        # ---------------------------------------------------------
        # FINAL RESULT
        # ---------------------------------------------------------
        return {
            "text": text,
            "emotion": {
                "label": dominant_emotion["label"],
                "probability": dominant_emotion["probability"],
                "source": dominant_emotion["source"],
            },
            "goemotions": {
                "dominant_emotion": {
                    "label": dominant_emotion["label"],
                    "probability": dominant_emotion["probability"],
                },
                "secondary_emotions": secondary_emotions,
                "probabilities": emotion_probabilities,
                "raw_probabilities": raw_probabilities,
                "active_emotions": active_emotions,
                "is_long_entry": aggregation_meta["is_long_entry"],
                "chunk_count": aggregation_meta["chunk_count"],
            },
            "sentiment": sentiment,
            "risk": risk,
            "reflection": {
                "summary": reflection_summary,
            },
        }


if __name__ == "__main__":
    predictor = MentalHealthPredictor()

    test_sentences = [
        "I had a great day and I'm excited about tomorrow.",
        "I am nervous about my exam.",
        "I feel hopeless and trapped.",
        "I don't want to live anymore.",
        "I want to hurt myself.",
        "I am not suicidal and I don't want to hurt myself.",
        "I passed my exam and I'm happy, but I'm also nervous about what comes next.",
        "I went to college today.",
        "My friend said he wanted to die.",
    ]

    for sample_text in test_sentences:
        result = predictor.analyze(sample_text)
        print(json.dumps(result["emotion"], indent=2, default=str))
        print(json.dumps(result["risk"], indent=2, default=str))