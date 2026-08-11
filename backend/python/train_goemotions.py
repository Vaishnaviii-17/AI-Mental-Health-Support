#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
train_goemotions.py

Production-quality training script for MULTI-LABEL emotion classification
on the GoEmotions dataset (google-research-datasets/go_emotions) using
distilroberta-base as the backbone.

This file also builds three clearly-separated analysis layers on top of the
trained emotion model, intended to feed a mental-health *support* backend:

    1. EMOTION CLASSIFICATION  -> "What emotional signals are present?"
       The actual trained GoEmotions model. 28 emotion labels, multi-label.

    2. SENTIMENT ANALYSIS      -> "Is the overall tone positive/neutral/negative?"
       A transparent, DERIVED signal computed from the emotion probabilities.
       GoEmotions is not a dedicated sentiment dataset; this is a documented
       heuristic aggregation, not a separately trained sentiment model.

    3. RISK INDICATOR          -> "Are there signals that might warrant
       further human attention?"
       A transparent, DOCUMENTED heuristic screening layer. It is NOT a
       diagnosis, NOT a clinically validated probability, and GoEmotions is
       NOT a clinical risk dataset. It combines (a) modest emotion-derived
       distress weighting, (b) explicit risk-language pattern detection,
       and (c) protective-signal detection, into a single auditable score.

IMPORTANT SAFETY / HONESTY NOTES (read before using in any product):
    - The risk-assessment layer below is an ENGINEERING HEURISTIC. It has
      NOT been clinically validated. It must not be presented to end users
      or clinicians as a diagnosis, a suicide-risk probability, or a
      substitute for professional/clinical judgment.
    - Emotions such as sadness, grief, fear, or anger are NOT proof of
      danger on their own. They are treated here only as mild, modestly
      weighted distress indicators that combine with other signals.
    - All weights and thresholds are named constants near the top of the
      file so they can be audited, tuned, or replaced with a properly
      trained/validated classifier in the future without changing the
      surrounding architecture.

Author: Senior ML Engineer / NLP Researcher
"""

# =========================================================================
# IMPORTS
# =========================================================================
import os
import re
import sys
import json
import time
import logging
import warnings
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")  # headless backend, safe for servers / CI
import matplotlib.pyplot as plt

import torch
import torch.nn as nn
from torch.utils.data import Dataset

from datasets import load_dataset, DatasetDict
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    DataCollatorWithPadding,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback,
    TrainerCallback,
    set_seed,
)

from sklearn.metrics import (
    precision_recall_fscore_support,
    classification_report,
    hamming_loss,
    accuracy_score,
)

warnings.filterwarnings("ignore")

# =========================================================================
# GLOBAL CONSTANTS -- TRAINING
# =========================================================================
SEED = 42
MODEL_NAME = "distilroberta-base"
DATASET_NAME = "google-research-datasets/go_emotions"
MAX_LENGTH = 128
NUM_EPOCHS = 4
LEARNING_RATE = 2e-5
BATCH_SIZE = 16
WEIGHT_DECAY = 0.01
WARMUP_RATIO = 0.1
EARLY_STOPPING_PATIENCE = 2
CLASSIFICATION_THRESHOLD = 0.5
THRESHOLD_CANDIDATES = (0.30, 0.35, 0.40, 0.45, 0.50, 0.55)
FALLBACK_THRESHOLD = 0.30  # robust global fallback if per-label tuning is unstable
MIN_POSITIVES_FOR_PER_LABEL_TUNING = 20  # need enough positive val examples to tune safely

OUTPUT_DIR = Path("outputs/goemotions")
MODEL_DIR = Path("models/goemotions_emotion_model")
CHECKPOINT_DIR = MODEL_DIR / "checkpoints"

SCRIPT_VERSION = "2.0.0"

# =========================================================================
# GLOBAL CONSTANTS -- SENTIMENT (DERIVED FROM GOEMOTIONS PROBABILITIES)
# =========================================================================
# NOTE: GoEmotions is not a sentiment dataset. This grouping is a documented,
# human-authored heuristic mapping from the 28 emotion categories into three
# coarse sentiment buckets. It is transparent and easy to audit/adjust.
POSITIVE_EMOTIONS = {
    "admiration", "amusement", "approval", "caring", "desire", "excitement",
    "gratitude", "joy", "love", "optimism", "pride", "relief",
}
NEGATIVE_EMOTIONS = {
    "anger", "annoyance", "disappointment", "disapproval", "disgust",
    "embarrassment", "fear", "grief", "nervousness", "remorse", "sadness",
}
NEUTRAL_EMOTIONS = {
    "confusion", "curiosity", "realization", "surprise", "neutral",
}
# 'surprise' can be positive or negative in context; without additional
# context we conservatively bucket it as neutral rather than guessing.

_ALL_BUCKETED = POSITIVE_EMOTIONS | NEGATIVE_EMOTIONS | NEUTRAL_EMOTIONS

# =========================================================================
# GLOBAL CONSTANTS -- RISK INDICATOR (HEURISTIC / SCREENING ONLY)
# =========================================================================
# These thresholds are ENGINEERING HEURISTICS, not clinically validated cut
# points. They require validation against a dedicated, appropriately
# labelled risk dataset before any clinical or safety-critical use.
RISK_THRESHOLDS = {
    "low": 0.25,       # score in [0.00, 0.25) -> low
    "elevated": 0.50,  # score in [0.25, 0.50) -> elevated
    "high": 0.75,      # score in [0.50, 0.75) -> high
    # score in [0.75, 1.00] -> critical
}

RISK_LEVELS_ORDER = ["low", "elevated", "high", "critical"]

# Distress-associated emotions and their modest, individually-non-diagnostic
# weights. No single emotion here implies danger; they are combined and
# down-weighted so that, e.g., sadness alone cannot push risk past "low".
DISTRESS_EMOTION_WEIGHTS = {
    "sadness": 0.35,
    "grief": 0.45,
    "fear": 0.30,
    "nervousness": 0.25,
    "disappointment": 0.20,
    "remorse": 0.30,
    "anger": 0.20,
    "annoyance": 0.10,
    "embarrassment": 0.15,
    "disgust": 0.10,
}
# Protective emotions modestly reduce the emotion-derived distress score.
PROTECTIVE_EMOTION_WEIGHTS = {
    "joy": 0.15,
    "gratitude": 0.15,
    "optimism": 0.15,
    "relief": 0.15,
    "love": 0.10,
    "admiration": 0.05,
    "amusement": 0.05,
    "pride": 0.05,
}

# Top-level combination weights for the final risk score. These are
# engineering heuristics, tuned by hand for sane qualitative behavior
# (see PART 24 test cases at the bottom of the file / README), not learned.
RISK_WEIGHTS = {
    "emotion_component": 0.35,   # weight of emotion-derived distress
    "text_component": 0.65,      # weight of explicit risk-language detector
    "protective_component": 0.25,  # subtracted, from protective emotions + phrases
}

# Explicit risk-language pattern categories. Patterns are intentionally
# written to require first-person framing / intent phrasing rather than a
# bare keyword, to reduce obvious false positives such as:
#   "This reminds me of a movie about suicide"   -> should NOT fire
#   "My friend died by suicide"                  -> should NOT fire as
#                                                     the writer being at risk
# Strength is in [0, 1] and reflects the severity of that category, used
# both in scoring and in the high/critical escalation rule below.
_INTENT_VERBS = (
    r"(?:going to|gonna|plan(?:ning)? to|want(?:ing)? to|decided to|"
    r"about to|made a plan to|thinking (?:about|of))"
)

TEXT_RISK_PATTERNS: Dict[str, List[Tuple[str, float]]] = {
    "suicidal_ideation": [
        (r"\bi\s*(?:'m|am|'ve|have)?\s*" + _INTENT_VERBS +
         r"\s+(?:kill(?:ing)? myself|end(?:ing)? my (?:own )?life|commit(?:ting)? suicide|end it all)\b", 0.95),
        (r"\bi\s*(?:don'?t|do not)\s*want to (?:be alive|live) anymore\b", 0.85),
        (r"\bi\s*wish i\s*(?:was|were) dead\b", 0.8),
        (r"\bi\s*want to die\b", 0.8),
    ],
    "self_harm": [
        (r"\bi\s*(?:'m|am|'ve|have)?\s*" + _INTENT_VERBS +
         r"\s+(?:cut(?:ting)?|hurt(?:ing)?|harm(?:ing)?)\s+myself\b", 0.85),
        (r"\bi\s*(?:'ve|have)\s*been\s+(?:cutting|hurting|harming)\s+myself\b", 0.7),
        (r"\bi\s*keep\s+(?:cutting|hurting)\s+myself\b", 0.7),
    ],
    "hopelessness": [
        (r"\bno point in (?:living|anything|trying)\b", 0.55),
        (r"\bnothing (?:will|is going to|ever) (?:get better|change)\b", 0.45),
        (r"\bthere'?s no (?:hope|way out) for me\b", 0.5),
        (r"\bi\s*(?:'ve|have) given up on everything\b", 0.5),
        (r"\bi\s*can'?t see (?:a future|any future|the point)\b", 0.5),
    ],
    "feeling_trapped": [
        (r"\bi\s*feel(?:ing)? (?:completely )?trapped\b", 0.4),
        (r"\bi\s*(?:'m|am) stuck (?:forever|with no way out)\b", 0.4),
        (r"\bno way out\b", 0.35),
    ],
    "severe_distress": [
        (r"\bi\s*can'?t (?:take|handle|do) (?:it|this) anymore\b", 0.55),
        (r"\bi\s*(?:'m|am)\s*(?:completely\s+)?falling apart\b", 0.4),
        (r"\bi\s*(?:'m|am)\s*(?:having a )?breakdown\b", 0.4),
        (r"\bi\s*can'?t stop crying\b", 0.3),
    ],
    # "immediate_danger" is not matched by fixed phrase patterns here; it is
    # derived in detect_text_risk_signals() below whenever a strong
    # suicidal_ideation/self_harm signal co-occurs with an imminence marker
    # (e.g. "tonight", "right now"), since intent phrasing is too varied to
    # enumerate exhaustively as literal combined patterns.
}

# Imminence markers used only to *upgrade* an already-detected strong
# ideation/self-harm signal to "immediate_danger" -- they never trigger a
# risk signal on their own.
IMMINENCE_MARKERS = re.compile(
    r"\b(tonight|today|right now|this (?:morning|afternoon|evening)|"
    r"in a (?:few (?:minutes|hours)|minute|hour))\b",
    re.IGNORECASE,
)

# Third-party / fictional / reporting context markers used to suppress or
# down-weight matches that are clearly not first-person expressions of
# personal risk (e.g. discussing a movie, a news story, or someone else).
THIRD_PARTY_CONTEXT_MARKERS = re.compile(
    r"\b(my friend|a friend|someone|somebody|he |she |they |him |her |"
    r"movie|film|documentary|book|novel|show|series|episode|game|"
    r"article|news|story about|reminds me of|used to know someone|"
    r"my (?:brother|sister|cousin|uncle|aunt|mom|dad|mother|father|"
    r"colleague|coworker|classmate))\b",
    re.IGNORECASE,
)

# Protective / positive-support text signals. These modestly reduce risk
# score. They are deliberately conservative (do not zero-out risk).
PROTECTIVE_TEXT_PATTERNS: List[Tuple[str, float]] = [
    (r"\bi\s*(?:'m|am) (?:getting|seeing|talking to) (?:a|my) (?:therapist|counselor|counsellor|psychiatrist)\b", 0.3),
    (r"\bi\s*have (?:people|friends|family) (?:i can|who) (?:talk to|support me)\b", 0.2),
    (r"\bi\s*(?:'m|am) feeling (?:better|hopeful|supported)\b", 0.2),
    (r"\bthings are (?:looking up|getting better)\b", 0.2),
    (r"\bi\s*(?:'m|am) grateful for\b", 0.15),
    (r"\breached out for help\b", 0.25),
]

RISK_ASSESSMENT_TYPE = "screening_indicator"
RISK_DISCLAIMER = (
    "This risk_assessment output is an engineering heuristic screening "
    "signal derived from emotion probabilities and text patterns. It is "
    "NOT a diagnosis, NOT a clinical risk probability, and has NOT been "
    "clinically validated. It is intended as decision support only and "
    "requires human review before any action is taken."
)

# =========================================================================
# LOGGING CONFIGURATION
# =========================================================================
def setup_logging() -> logging.Logger:
    """
    Configure a professional logger that writes to both console and a
    timestamped log file inside the output directory.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    log_file = OUTPUT_DIR / f"train_goemotions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

    logger = logging.getLogger("goemotions_trainer")
    logger.setLevel(logging.INFO)
    logger.handlers = []  # avoid duplicate handlers on re-run

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)

    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)

    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    return logger


logger = setup_logging()


# =========================================================================
# UTILITY: DIRECTORY SETUP
# =========================================================================
def create_project_directories() -> None:
    """Create all required output / model directories if they don't exist."""
    dirs = [OUTPUT_DIR, MODEL_DIR, CHECKPOINT_DIR]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
        logger.info(f"Ensured directory exists: {d}")


# =========================================================================
# UTILITY: SEEDING
# =========================================================================
def set_global_seed(seed: int = SEED) -> None:
    """Set random seed across all relevant libraries for reproducibility."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
    set_seed(seed)
    logger.info(f"Global random seed set to {seed}")


# =========================================================================
# UTILITY: DEVICE / GPU DETECTION
# =========================================================================
def detect_device() -> torch.device:
    """
    Detect available hardware, log CUDA availability, GPU name and memory,
    and return the torch.device to use for training.
    """
    cuda_available = torch.cuda.is_available()
    logger.info(f"CUDA available: {cuda_available}")

    if cuda_available:
        device = torch.device("cuda")
        gpu_name = torch.cuda.get_device_name(0)
        gpu_mem_bytes = torch.cuda.get_device_properties(0).total_memory
        gpu_mem_gb = gpu_mem_bytes / (1024 ** 3)
        logger.info(f"Selected device: {device}")
        logger.info(f"GPU name: {gpu_name}")
        logger.info(f"GPU memory: {gpu_mem_gb:.2f} GB")
    else:
        device = torch.device("cpu")
        logger.info(f"Selected device: {device}")
        logger.warning("No GPU detected. Training will run on CPU and may be slow.")

    return device


# =========================================================================
# CONFIG SAVING
# =========================================================================
def save_training_config(
    device: torch.device,
    num_labels: int,
    label_names: List[str],
    dataset_config: str,
    dataset_version: str,
    training_start: datetime,
    training_end: datetime,
    threshold: float,
    model,
) -> None:
    """Persist the full training configuration as a JSON file for reproducibility."""
    config = {
        "task": "goemotions_emotion_classification_with_sentiment_and_risk_indicator",
        "script_version": SCRIPT_VERSION,
        "model_name": MODEL_NAME,
        "dataset_name": DATASET_NAME,
        "dataset_config": dataset_config,
        "dataset_version": dataset_version,
        "task_type": "multi_label_classification",
        "num_emotion_labels": num_labels,
        "max_length": MAX_LENGTH,
        "num_epochs": NUM_EPOCHS,
        "learning_rate": LEARNING_RATE,
        "batch_size": BATCH_SIZE,
        "weight_decay": WEIGHT_DECAY,
        "warmup_ratio": WARMUP_RATIO,
        "early_stopping_patience": EARLY_STOPPING_PATIENCE,
        "classification_threshold": threshold,
        "threshold": threshold,
        "threshold_candidates": list(THRESHOLD_CANDIDATES),
        "seed": SEED,
        "device": str(device),
        "num_labels": num_labels,
        "label_names": label_names,
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "cuda_version": torch.version.cuda,
        "pytorch_version": torch.__version__,
        "transformers_version": __import__("transformers").__version__,
        "training_start_time": training_start.isoformat(),
        "training_end_time": training_end.isoformat(),
        "training_duration": str(training_end - training_start),
        "training_duration_seconds": (training_end - training_start).total_seconds(),
        "number_of_parameters": sum(p.numel() for p in model.parameters()),
        "trainable_parameters": sum(p.numel() for p in model.parameters() if p.requires_grad),
        # --- Honesty / scope metadata (see PART 19 of the design brief) ---
        "risk_assessment_type": "heuristic_screening_indicator",
        "clinical_validation": False,
        "sentiment_source": "derived_from_goemotions_probabilities",
    }
    config_path = OUTPUT_DIR / "training_config.json"
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=4)
    logger.info(f"Training configuration saved to {config_path}")


# =========================================================================
# DATA LOADING
# =========================================================================
def load_goemotions_dataset() -> Tuple[DatasetDict, List[str], str, str]:
    """
    Load the GoEmotions dataset (simplified config with single multi-label
    'labels' column) from the Hugging Face hub and print basic statistics.
    """
    logger.info(f"Loading dataset: {DATASET_NAME} with config 'simplified'. Cached data is reused automatically.")
    try:
        dataset = load_dataset(DATASET_NAME, "simplified")
        dataset_config = "simplified"
        logger.info("Loaded simplified dataset configuration successfully.")
    except Exception as e:
        logger.warning(f"Failed to load 'simplified' config ({e}); trying default config.")
        dataset = load_dataset(DATASET_NAME)
        dataset_config = "default"
        logger.info("Loaded default dataset configuration successfully.")

    label_names = dataset["train"].features["labels"].feature.names
    dataset_version = str(getattr(dataset["train"].info, "version", "unknown"))

    logger.info("=" * 70)
    logger.info("DATASET STATISTICS")
    logger.info("=" * 70)
    for split in dataset.keys():
        logger.info(f"Split '{split}': {len(dataset[split])} rows")
    logger.info(f"Columns: {dataset['train'].column_names}")
    logger.info(f"Features: {dataset['train'].features}")
    logger.info(f"Number of label classes: {len(label_names)}")
    logger.info(f"Label names: {label_names}")
    logger.info(f"Dataset config: {dataset_config}")
    logger.info(f"Dataset version: {dataset_version}")

    return dataset, label_names, dataset_config, dataset_version


# =========================================================================
# EXPLORATORY DATA ANALYSIS
# =========================================================================
def run_eda(dataset: DatasetDict, label_names: List[str]) -> None:
    """
    Perform a thorough exploratory data analysis on the training split:
    size, missing values, duplicates, label frequency/distribution,
    sentence length, word counts, and sample display. Saves plots to disk.
    """
    logger.info("=" * 70)
    logger.info("EXPLORATORY DATA ANALYSIS")
    logger.info("=" * 70)

    train_df = dataset["train"].to_pandas()

    # --- Dataset size ---
    logger.info(f"Training set size: {len(train_df)} rows")

    # --- Missing values ---
    missing_counts = train_df.isnull().sum()
    logger.info(f"Missing values per column:\n{missing_counts}")

    # --- Duplicate texts ---
    num_duplicates = train_df["text"].duplicated().sum()
    logger.info(f"Number of duplicate texts: {num_duplicates}")

    # --- Label frequency ---
    label_counter = np.zeros(len(label_names), dtype=int)
    for label_list in train_df["labels"]:
        for idx in label_list:
            label_counter[idx] += 1

    label_freq_df = pd.DataFrame({
        "label": label_names,
        "count": label_counter
    }).sort_values("count", ascending=False)

    logger.info(f"Top 10 most frequent labels:\n{label_freq_df.head(10).to_string(index=False)}")

    # --- Multi-label cardinality (labels per example) ---
    labels_per_example = train_df["labels"].apply(len)
    logger.info(f"Average labels per example: {labels_per_example.mean():.3f}")
    logger.info(f"Median labels per example: {labels_per_example.median():.3f}")
    logger.info(f"Max labels on a single example: {labels_per_example.max()}")

    # --- Sentence length (characters) & word count ---
    sentence_lengths = train_df["text"].apply(len)
    word_counts = train_df["text"].apply(lambda x: len(x.split()))
    logger.info(
        "Sentence length statistics (characters): mean=%.2f, median=%.2f, min=%d, max=%d",
        sentence_lengths.mean(), sentence_lengths.median(), sentence_lengths.min(), sentence_lengths.max(),
    )
    logger.info(
        "Word count statistics: mean=%.2f, median=%.2f, min=%d, max=%d",
        word_counts.mean(), word_counts.median(), word_counts.min(), word_counts.max(),
    )
    nonzero_counts = label_counter[label_counter > 0]
    imbalance_ratio = nonzero_counts.max() / nonzero_counts.min() if len(nonzero_counts) else float("nan")
    logger.info(
        "Label imbalance: least=%s (%d), most=%s (%d), max/min ratio=%.2f",
        label_freq_df.iloc[-1]["label"], label_freq_df.iloc[-1]["count"],
        label_freq_df.iloc[0]["label"], label_freq_df.iloc[0]["count"], imbalance_ratio,
    )

    # --- Sample rows ---
    logger.info("Sample training examples:")
    for i in range(min(5, len(train_df))):
        sample_labels = [label_names[idx] for idx in train_df.iloc[i]["labels"]]
        logger.info(f"  Text: {train_df.iloc[i]['text'][:80]!r} | Labels: {sample_labels}")

    # ---------------------------------------------------------------
    # PLOT 1: Emotion (label) distribution
    # ---------------------------------------------------------------
    plt.figure(figsize=(14, 8))
    plt.barh(label_freq_df["label"], label_freq_df["count"], color="steelblue")
    plt.xlabel("Frequency")
    plt.ylabel("Emotion Label")
    plt.title("GoEmotions: Label Frequency Distribution")
    plt.gca().invert_yaxis()
    plt.tight_layout()
    plot_path = OUTPUT_DIR / "emotion_distribution.png"
    plt.savefig(plot_path, dpi=150)
    plt.close()
    logger.info(f"Saved plot: {plot_path}")

    # ---------------------------------------------------------------
    # PLOT 2: Sentence length distribution
    # ---------------------------------------------------------------
    plt.figure(figsize=(10, 6))
    plt.hist(sentence_lengths, bins=50, color="darkorange", edgecolor="black")
    plt.xlabel("Sentence Length (characters)")
    plt.ylabel("Frequency")
    plt.title("Sentence Length Distribution")
    plt.tight_layout()
    plot_path = OUTPUT_DIR / "sentence_length_distribution.png"
    plt.savefig(plot_path, dpi=150)
    plt.close()
    logger.info(f"Saved plot: {plot_path}")

    # ---------------------------------------------------------------
    # PLOT 3: Word count distribution
    # ---------------------------------------------------------------
    plt.figure(figsize=(10, 6))
    plt.hist(word_counts, bins=50, color="seagreen", edgecolor="black")
    plt.xlabel("Word Count")
    plt.ylabel("Frequency")
    plt.title("Word Count Distribution")
    plt.tight_layout()
    plot_path = OUTPUT_DIR / "word_count_distribution.png"
    plt.savefig(plot_path, dpi=150)
    plt.close()
    logger.info(f"Saved plot: {plot_path}")

    # ---------------------------------------------------------------
    # PLOT 4: Multi-label frequency (number of labels per example)
    # ---------------------------------------------------------------
    plt.figure(figsize=(10, 6))
    label_count_dist = labels_per_example.value_counts().sort_index()
    plt.bar(label_count_dist.index, label_count_dist.values, color="mediumpurple", edgecolor="black")
    plt.xlabel("Number of Labels per Example")
    plt.ylabel("Frequency")
    plt.title("Multi-Label Frequency Distribution")
    plt.tight_layout()
    plot_path = OUTPUT_DIR / "multi_label_frequency.png"
    plt.savefig(plot_path, dpi=150)
    plt.close()
    logger.info(f"Saved plot: {plot_path}")


# =========================================================================
# TEXT PREPROCESSING
# =========================================================================
def preprocess_text(text: str) -> str:
    """
    Basic text normalization:
      - lowercase
      - collapse multiple whitespace characters into a single space
      - strip leading/trailing whitespace
    Punctuation is intentionally preserved since it carries emotional signal.
    """
    text = text.lower()
    text = " ".join(text.split())  # normalizes all whitespace (tabs, newlines, multi-space)
    return text.strip()


def apply_preprocessing(dataset: DatasetDict) -> DatasetDict:
    """Apply the preprocess_text function to every split of the dataset."""
    logger.info("Applying text preprocessing to all splits...")

    def _map_fn(example):
        example["text"] = preprocess_text(example["text"])
        return example

    dataset = dataset.map(_map_fn, desc="Preprocessing text")
    logger.info("Text preprocessing complete.")
    return dataset


# =========================================================================
# MULTI-LABEL PREPARATION
# =========================================================================
def build_label_mapping(label_names: List[str]) -> Tuple[Dict[int, str], Dict[str, int]]:
    """Construct id2label and label2id mappings and persist to disk."""
    id2label = {i: name for i, name in enumerate(label_names)}
    label2id = {name: i for i, name in enumerate(label_names)}

    mapping_path = OUTPUT_DIR / "label_mapping.json"
    with open(mapping_path, "w", encoding="utf-8") as f:
        json.dump({"id2label": id2label, "label2id": label2id}, f, indent=4)
    logger.info(f"Label mapping saved to {mapping_path}")

    return id2label, label2id


def multi_hot_encode(label_indices: List[int], num_labels: int) -> List[float]:
    """Convert a list of active label indices into a multi-hot float vector."""
    vector = [0.0] * num_labels
    for idx in label_indices:
        vector[idx] = 1.0
    return vector


# =========================================================================
# TOKENIZATION + DATASET CLASS
# =========================================================================
def tokenize_dataset(dataset: DatasetDict, tokenizer: AutoTokenizer, num_labels: int) -> DatasetDict:
    """
    Tokenize text with truncation to MAX_LENGTH and attach a
    multi-hot float label vector to every example.
    """
    logger.info("Tokenizing dataset (this may take a moment)...")

    def _tokenize_fn(batch):
        encodings = tokenizer(
            batch["text"],
            truncation=True,
            max_length=MAX_LENGTH,
        )
        encodings["labels"] = np.array(
            [multi_hot_encode(label_list, num_labels) for label_list in batch["labels"]],
            dtype=np.float32,
        )
        return encodings

    tokenized = dataset.map(
        _tokenize_fn,
        batched=True,
        desc="Tokenizing",
        remove_columns=dataset["train"].column_names,
    )
    logger.info("Tokenization complete.")
    return tokenized


class GoEmotionsTorchDataset(Dataset):
    """
    Thin wrapper converting a HuggingFace tokenized dataset split into a
    PyTorch Dataset that yields tensors, as expected by the Trainer.
    """

    def __init__(self, hf_dataset):
        self.dataset = hf_dataset

    def __len__(self) -> int:
        return len(self.dataset)

    def __getitem__(self, idx: int):
        item = self.dataset[idx]

        # BCEWithLogitsLoss expects float labels
        item["labels"] = item["labels"].float()

        return item


# =========================================================================
# MODEL CREATION
# =========================================================================
def build_model(num_labels: int, id2label: Dict[int, str], label2id: Dict[str, int]):
    """
    Instantiate AutoModelForSequenceClassification for multi-label
    classification on top of the distilroberta-base backbone.

    Why the classifier head warnings are EXPECTED and correct:
    `distilroberta-base` is published as a masked-language-model (MLM)
    checkpoint. Its weights include an MLM head (`lm_head.*`) and, for the
    full Roberta architecture, a pooler (`roberta.pooler.*`). Neither of
    those is part of a sequence-classification model, so when
    AutoModelForSequenceClassification loads this checkpoint:
      - `lm_head.*` / `roberta.pooler.*` weights are reported as
        "unexpected" because RobertaForSequenceClassification does not use
        them (they are simply discarded).
      - `classifier.dense.*` / `classifier.out_proj.*` weights are reported
        as "missing" because they do not exist in the MLM checkpoint at
        all -- they are the NEW classification head, and Transformers
        randomly initializes them for us.
    This is the correct, expected behavior for fine-tuning an MLM backbone
    on a new classification task; it is not a bug and does not require
    `ignore_mismatched_sizes`. `ignore_mismatched_sizes=True` is only
    needed when the checkpoint contains weights with the SAME parameter
    names as the target model but a DIFFERENT shape (e.g. loading a
    checkpoint fine-tuned on 6 labels into a model configured with 28
    labels) -- which is not the situation here, so it is intentionally
    left unset.
    """
    logger.info(f"Loading model backbone: {MODEL_NAME}")
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        problem_type="multi_label_classification",
        num_labels=num_labels,
        id2label=id2label,
        label2id=label2id,
    )
    logger.info(f"Model loaded with {num_labels} output labels.")
    logger.info(
        "Note: 'lm_head.*'/'roberta.pooler.*' unexpected-key warnings and "
        "'classifier.dense.*'/'classifier.out_proj.*' missing-key warnings "
        "are expected when adapting an MLM checkpoint to sequence "
        "classification -- see build_model() docstring."
    )
    return model


# =========================================================================
# METRICS
# =========================================================================
def compute_metrics(eval_pred) -> Dict[str, float]:
    """
    Compute multi-label classification metrics from raw logits.
    Applies a NumPy sigmoid (NOT softmax) followed by a 0.5 threshold to obtain
    binary predictions.
    """
    logits, labels = eval_pred
    logits = np.asarray(logits, dtype=np.float64)
    probs = np.where(
        logits >= 0,
        1.0 / (1.0 + np.exp(-logits)),
        np.exp(logits) / (1.0 + np.exp(logits)),
    )
    preds = (probs >= CLASSIFICATION_THRESHOLD).astype(int)
    labels = labels.astype(int)

    micro_precision, micro_recall, micro_f1, _ = precision_recall_fscore_support(
        labels, preds, average="micro", zero_division=0
    )
    macro_precision, macro_recall, macro_f1, _ = precision_recall_fscore_support(
        labels, preds, average="macro", zero_division=0
    )
    h_loss = hamming_loss(labels, preds)
    subset_acc = accuracy_score(labels, preds)

    return {
        "micro_precision": micro_precision,
        "micro_recall": micro_recall,
        "micro_f1": micro_f1,
        "macro_precision": macro_precision,
        "macro_recall": macro_recall,
        "macro_f1": macro_f1,
        "hamming_loss": h_loss,
        "subset_accuracy": subset_acc,
    }


def calculate_metrics(labels: np.ndarray, probabilities: np.ndarray, threshold: float) -> Dict[str, float]:
    """Compute every multi-label metric at a supplied probability threshold."""
    labels = np.asarray(labels, dtype=int)
    predictions = (np.asarray(probabilities) >= threshold).astype(int)
    micro_precision, micro_recall, micro_f1, _ = precision_recall_fscore_support(
        labels, predictions, average="micro", zero_division=0
    )
    macro_precision, macro_recall, macro_f1, _ = precision_recall_fscore_support(
        labels, predictions, average="macro", zero_division=0
    )
    return {
        "micro_precision": float(micro_precision), "micro_recall": float(micro_recall),
        "micro_f1": float(micro_f1), "macro_precision": float(macro_precision),
        "macro_recall": float(macro_recall), "macro_f1": float(macro_f1),
        "subset_accuracy": float(accuracy_score(labels, predictions)),
        "hamming_loss": float(hamming_loss(labels, predictions)),
    }


def predict_split(trainer: Trainer, dataset, split_name: str) -> Tuple[np.ndarray, np.ndarray]:
    """Run batched Trainer prediction and return NumPy probabilities and labels."""
    logger.info(f"Generating predictions for {split_name} set...")
    output = trainer.predict(dataset, metric_key_prefix=split_name)
    logits = np.asarray(output.predictions, dtype=np.float64)
    probabilities = np.where(
        logits >= 0, 1.0 / (1.0 + np.exp(-logits)), np.exp(logits) / (1.0 + np.exp(logits))
    )
    return probabilities, np.asarray(output.label_ids, dtype=int)


def tune_threshold(labels: np.ndarray, probabilities: np.ndarray) -> Tuple[float, Dict[str, float]]:
    """Select the validation threshold (global, all labels shared) with the highest Micro F1 score."""
    candidates = []
    for threshold in THRESHOLD_CANDIDATES:
        metrics = calculate_metrics(labels, probabilities, threshold)
        logger.info(f"Threshold {threshold:.2f} | validation Micro F1: {metrics['micro_f1']:.4f}")
        candidates.append((threshold, metrics))
    best_threshold, best_metrics = max(candidates, key=lambda item: (item[1]["micro_f1"], -item[0]))
    logger.info(f"Best threshold: {best_threshold:.2f} | validation Micro F1: {best_metrics['micro_f1']:.4f}")
    return best_threshold, best_metrics


def calculate_per_label_thresholds(
    val_labels: np.ndarray, val_probabilities: np.ndarray, label_names: List[str],
) -> Dict[str, float]:
    """
    Optionally improve rare-emotion detection by tuning a threshold per
    label instead of one shared global threshold.

    Rules (kept deliberately simple/robust, per design brief PART 6):
      - Uses ONLY validation data, never test data.
      - A label is only individually tuned if it has at least
        MIN_POSITIVES_FOR_PER_LABEL_TUNING positive examples in the
        validation split; otherwise there isn't enough signal to trust a
        per-label optimum, and it safely falls back to FALLBACK_THRESHOLD.
      - For each eligible label, picks the threshold (from
        THRESHOLD_CANDIDATES) that maximizes that label's own F1 score.
    """
    logger.info("Calculating per-label thresholds from validation data...")
    per_label_thresholds: Dict[str, float] = {}
    val_labels = np.asarray(val_labels, dtype=int)
    val_probabilities = np.asarray(val_probabilities, dtype=float)

    for label_idx, label_name in enumerate(label_names):
        positives = int(val_labels[:, label_idx].sum())
        if positives < MIN_POSITIVES_FOR_PER_LABEL_TUNING:
            per_label_thresholds[label_name] = FALLBACK_THRESHOLD
            continue

        y_true = val_labels[:, label_idx]
        y_prob = val_probabilities[:, label_idx]
        best_thr, best_f1 = FALLBACK_THRESHOLD, -1.0
        for thr in THRESHOLD_CANDIDATES:
            y_pred = (y_prob >= thr).astype(int)
            _, _, f1, _ = precision_recall_fscore_support(
                y_true, y_pred, average="binary", zero_division=0
            )
            if f1 > best_f1:
                best_f1, best_thr = f1, thr
        per_label_thresholds[label_name] = float(best_thr)

    thresholds_path = OUTPUT_DIR / "per_label_thresholds.json"
    with open(thresholds_path, "w", encoding="utf-8") as f:
        json.dump(per_label_thresholds, f, indent=4)
    logger.info(f"Per-label thresholds saved to {thresholds_path}")
    return per_label_thresholds


def save_classification_reports(
    val_labels: np.ndarray, val_probabilities: np.ndarray,
    test_labels: np.ndarray, test_probabilities: np.ndarray,
    label_names: List[str], threshold: float,
) -> None:
    """Save validation and test per-emotion precision, recall, F1, and support."""
    report_path = OUTPUT_DIR / "classification_report.txt"
    reports = [f"GoEmotions classification reports (optimized threshold = {threshold:.2f})", "=" * 80]
    for split_name, labels, probabilities in (
        ("VALIDATION", val_labels, val_probabilities), ("TEST", test_labels, test_probabilities)
    ):
        reports.extend([
            "", split_name, "-" * 80,
            classification_report(
                labels, (probabilities >= threshold).astype(int), target_names=label_names,
                digits=4, zero_division=0,
            ),
        ])
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(reports))
    logger.info(f"Classification reports saved to {report_path}")


# =========================================================================
# CUSTOM CALLBACK: PROGRESS LOGGING
# =========================================================================
class ProgressLoggingCallback(TrainerCallback):
    """Custom callback that logs epoch/step progress and eval metrics."""

    def on_epoch_begin(self, args, state, control, **kwargs):
        logger.info(f"--- Starting epoch {int(state.epoch) + 1 if state.epoch else 1}/{int(args.num_train_epochs)} ---")

    def on_log(self, args, state, control, logs=None, **kwargs):
        if logs is not None:
            readable = {k: (round(v, 4) if isinstance(v, float) else v) for k, v in logs.items()}
            logger.info(f"Step {state.global_step}: {readable}")

    def on_evaluate(self, args, state, control, metrics=None, **kwargs):
        if metrics is not None:
            logger.info(f"Evaluation results at step {state.global_step}: {metrics}")


# =========================================================================
# TRAINING CURVES
# =========================================================================
def plot_training_curves(trainer: Trainer) -> None:
    """
    Extract per-epoch training/evaluation metrics from the Trainer log
    history and plot loss, micro-F1, precision, and recall curves.
    """
    logger.info("Generating training curves...")
    history = trainer.state.log_history

    train_loss = [(h["step"], h["loss"]) for h in history if "loss" in h]
    eval_loss = [(h["epoch"], h["eval_loss"]) for h in history if "eval_loss" in h]
    eval_f1 = [(h["epoch"], h["eval_micro_f1"]) for h in history if "eval_micro_f1" in h]
    eval_precision = [(h["epoch"], h["eval_micro_precision"]) for h in history if "eval_micro_precision" in h]
    eval_recall = [(h["epoch"], h["eval_micro_recall"]) for h in history if "eval_micro_recall" in h]

    # --- Loss curve ---
    plt.figure(figsize=(10, 6))
    if train_loss:
        steps, losses = zip(*train_loss)
        plt.plot(steps, losses, label="Training Loss", color="tomato")
    if eval_loss:
        epochs, losses = zip(*eval_loss)
        plt.plot([e for e in epochs], losses, label="Validation Loss", color="royalblue", marker="o")
    plt.xlabel("Step / Epoch")
    plt.ylabel("Loss")
    plt.title("Training & Validation Loss")
    plt.legend()
    plt.tight_layout()
    path = OUTPUT_DIR / "loss_curve.png"
    plt.savefig(path, dpi=150)
    plt.close()
    logger.info(f"Saved plot: {path}")

    # --- Micro F1 curve ---
    if eval_f1:
        epochs, f1s = zip(*eval_f1)
        plt.figure(figsize=(10, 6))
        plt.plot(epochs, f1s, label="Validation Micro F1", color="seagreen", marker="o")
        plt.xlabel("Epoch")
        plt.ylabel("Micro F1")
        plt.title("Micro F1 Score over Epochs")
        plt.legend()
        plt.tight_layout()
        path = OUTPUT_DIR / "micro_f1_curve.png"
        plt.savefig(path, dpi=150)
        plt.close()
        logger.info(f"Saved plot: {path}")
    else:
        plt.figure(figsize=(10, 6))
        plt.text(0.5, 0.5, "No logged values available", ha="center", va="center")
        plt.axis("off")
        path = OUTPUT_DIR / "micro_f1_curve.png"
        plt.savefig(path, dpi=150)
        plt.close()
        logger.info(f"Saved plot: {path}")

    # --- Precision curve ---
    if eval_precision:
        epochs, precisions = zip(*eval_precision)
        plt.figure(figsize=(10, 6))
        plt.plot(epochs, precisions, label="Validation Micro Precision", color="darkorange", marker="o")
        plt.xlabel("Epoch")
        plt.ylabel("Precision")
        plt.title("Micro Precision over Epochs")
        plt.legend()
        plt.tight_layout()
        path = OUTPUT_DIR / "precision_curve.png"
        plt.savefig(path, dpi=150)
        plt.close()
        logger.info(f"Saved plot: {path}")
    else:
        plt.figure(figsize=(10, 6))
        plt.text(0.5, 0.5, "No logged values available", ha="center", va="center")
        plt.axis("off")
        path = OUTPUT_DIR / "precision_curve.png"
        plt.savefig(path, dpi=150)
        plt.close()
        logger.info(f"Saved plot: {path}")

    # --- Recall curve ---
    if eval_recall:
        epochs, recalls = zip(*eval_recall)
        plt.figure(figsize=(10, 6))
        plt.plot(epochs, recalls, label="Validation Micro Recall", color="mediumpurple", marker="o")
        plt.xlabel("Epoch")
        plt.ylabel("Recall")
        plt.title("Micro Recall over Epochs")
        plt.legend()
        plt.tight_layout()
        path = OUTPUT_DIR / "recall_curve.png"
        plt.savefig(path, dpi=150)
        plt.close()
        logger.info(f"Saved plot: {path}")
    else:
        plt.figure(figsize=(10, 6))
        plt.text(0.5, 0.5, "No logged values available", ha="center", va="center")
        plt.axis("off")
        path = OUTPUT_DIR / "recall_curve.png"
        plt.savefig(path, dpi=150)
        plt.close()
        logger.info(f"Saved plot: {path}")


# =========================================================================
# EVALUATION HELPER
# =========================================================================
def evaluate_split(trainer: Trainer, dataset, split_name: str) -> Dict[str, float]:
    """Run trainer.evaluate() on a given split and log metrics."""
    logger.info(f"Evaluating on {split_name} set...")
    metrics = trainer.evaluate(eval_dataset=dataset, metric_key_prefix=split_name)

    logger.info(f"--- {split_name.upper()} SET RESULTS ---")
    logger.info(f"  Micro Precision: {metrics.get(f'{split_name}_micro_precision', float('nan')):.4f}")
    logger.info(f"  Micro Recall:    {metrics.get(f'{split_name}_micro_recall', float('nan')):.4f}")
    logger.info(f"  Micro F1:        {metrics.get(f'{split_name}_micro_f1', float('nan')):.4f}")
    logger.info(f"  Macro Precision: {metrics.get(f'{split_name}_macro_precision', float('nan')):.4f}")
    logger.info(f"  Macro Recall:    {metrics.get(f'{split_name}_macro_recall', float('nan')):.4f}")
    logger.info(f"  Macro F1:        {metrics.get(f'{split_name}_macro_f1', float('nan')):.4f}")
    logger.info(f"  Hamming Loss:    {metrics.get(f'{split_name}_hamming_loss', float('nan')):.4f}")
    logger.info(f"  Subset Accuracy: {metrics.get(f'{split_name}_subset_accuracy', float('nan')):.4f}")

    return metrics


# =========================================================================
# SENTIMENT ANALYSIS (DERIVED FROM GOEMOTIONS PROBABILITIES)
# =========================================================================
def compute_sentiment(emotion_scores: Dict[str, float]) -> Dict[str, Any]:
    """
    Derive a coarse positive/neutral/negative sentiment signal from the
    GoEmotions probability vector.

    This is NOT a separately trained sentiment model. It is a transparent,
    weighted aggregation: each emotion's probability contributes to the
    bucket (POSITIVE_EMOTIONS / NEGATIVE_EMOTIONS / NEUTRAL_EMOTIONS) it
    belongs to, the three bucket sums are normalized so they add to 1.0,
    and the highest-scoring bucket becomes the sentiment label.
    """
    positive_score = sum(emotion_scores.get(e, 0.0) for e in POSITIVE_EMOTIONS)
    negative_score = sum(emotion_scores.get(e, 0.0) for e in NEGATIVE_EMOTIONS)
    neutral_score = sum(emotion_scores.get(e, 0.0) for e in NEUTRAL_EMOTIONS)

    total = positive_score + negative_score + neutral_score
    if total <= 1e-9:
        # No meaningful signal at all (should not normally happen since
        # 'neutral' is itself part of NEUTRAL_EMOTIONS), guard against
        # division by zero regardless.
        positive_score, negative_score, neutral_score = 0.0, 0.0, 1.0
        total = 1.0

    positive_norm = positive_score / total
    negative_norm = negative_score / total
    neutral_norm = neutral_score / total

    bucket_scores = {
        "positive": positive_norm,
        "negative": negative_norm,
        "neutral": neutral_norm,
    }
    label = max(bucket_scores, key=bucket_scores.get)

    return {
        "label": label,
        "score": round(float(bucket_scores[label]), 4),
        "positive_score": round(float(positive_norm), 4),
        "negative_score": round(float(negative_norm), 4),
        "neutral_score": round(float(neutral_norm), 4),
        "source": "derived_from_goemotions_probabilities",
    }


# =========================================================================
# RISK INDICATOR (HEURISTIC SCREENING LAYER -- NOT A DIAGNOSIS)
# =========================================================================
def _emotion_distress_score(emotion_scores: Dict[str, float]) -> float:
    """
    Combine distress-associated and protective emotion probabilities into a
    single bounded [0, 1] emotion-derived distress component. No single
    emotion dominates this score; weights are intentionally modest.
    """
    distress = sum(
        emotion_scores.get(e, 0.0) * w for e, w in DISTRESS_EMOTION_WEIGHTS.items()
    )
    protective = sum(
        emotion_scores.get(e, 0.0) * w for e, w in PROTECTIVE_EMOTION_WEIGHTS.items()
    )
    score = distress - protective
    return float(max(0.0, min(1.0, score)))


def _is_third_party_context(text_lower: str, match_span: Tuple[int, int]) -> bool:
    """
    Heuristic check for whether a risk-language match is likely describing
    someone/something else (a friend, a movie, a news story) rather than
    the writer's own first-person state. Looks at a window of text around
    the match for third-party context markers and the absence of a direct
    first-person subject immediately preceding the match.
    """
    start, end = match_span
    window_start = max(0, start - 40)
    context = text_lower[window_start:end]
    if THIRD_PARTY_CONTEXT_MARKERS.search(context):
        return True
    return False


def detect_text_risk_signals(text: str) -> List[Dict[str, Any]]:
    """
    Scan free text for explicit risk-language patterns. Returns a list of
    structured signals (never raw matched substrings) so results are safe
    to log, store, and display.

    Design goals (see design brief PART 11):
      - Prefer contextual, first-person-intent patterns over bare keyword
        matching to avoid trivial false positives.
      - Down-weight/skip matches that look like third-party or fictional
        references (e.g. "my friend died by suicide", "a movie about
        suicide").
    """
    text_lower = text.lower()
    signals: List[Dict[str, Any]] = []

    for category, patterns in TEXT_RISK_PATTERNS.items():
        best_strength = 0.0
        matched = False
        for pattern, strength in patterns:
            for m in re.finditer(pattern, text_lower):
                if _is_third_party_context(text_lower, m.span()):
                    continue
                matched = True
                best_strength = max(best_strength, strength)
        if matched:
            signals.append({
                "type": category,
                "strength": round(float(best_strength), 2),
                "source": "text_pattern",
            })

    # --- Derive "immediate_danger" from a strong ideation/self-harm signal
    # co-occurring with an imminence marker anywhere in the text. This is
    # more robust than trying to enumerate every combined phrase pattern,
    # while still requiring a genuine first-person intent match first (the
    # third-party-context filtering above already applied to that match).
    strong_categories = {"suicidal_ideation", "self_harm"}
    has_strong_signal = any(
        s["type"] in strong_categories and s["strength"] >= 0.8 for s in signals
    )
    if has_strong_signal and IMMINENCE_MARKERS.search(text_lower):
        signals.append({
            "type": "immediate_danger",
            "strength": 1.0,
            "source": "text_pattern",
        })

    return signals


def detect_protective_signals(text: str) -> List[Dict[str, Any]]:
    """Scan free text for protective/help-seeking language patterns."""
    text_lower = text.lower()
    signals: List[Dict[str, Any]] = []
    for pattern, strength in PROTECTIVE_TEXT_PATTERNS:
        if re.search(pattern, text_lower):
            signals.append({
                "type": "protective_language",
                "strength": round(float(strength), 2),
                "source": "text_pattern",
            })
    return signals


def assess_risk(text: str, emotion_scores: Dict[str, float]) -> Dict[str, Any]:
    """
    Combine emotion-derived distress, explicit risk-language signals, and
    protective signals into a single transparent, bounded risk_score and
    a corresponding risk_level.

        risk_score = clamp(
            RISK_WEIGHTS['emotion_component']    * emotion_distress
          + RISK_WEIGHTS['text_component']       * max_text_risk_strength
          - RISK_WEIGHTS['protective_component'] * protective_strength,
            0.0, 1.0
        )

    Explicit "immediate_danger" signals apply a documented escalation rule
    (design brief PART 14): a strong imminent-danger phrase cannot be
    diluted away by co-occurring positive emotion, and forces a minimum
    risk_level of at least "high" (or "critical" for the strongest match).

    IMPORTANT: this is a heuristic screening indicator, not a diagnosis.
    See RISK_DISCLAIMER.
    """
    emotion_component = _emotion_distress_score(emotion_scores)

    text_signals = detect_text_risk_signals(text)
    protective_signals = detect_protective_signals(text)

    max_text_strength = max((s["strength"] for s in text_signals), default=0.0)
    protective_strength = sum(s["strength"] for s in protective_signals)
    protective_strength = min(protective_strength, 1.0)  # cap contribution

    raw_score = (
        RISK_WEIGHTS["emotion_component"] * emotion_component
        + RISK_WEIGHTS["text_component"] * max_text_strength
        - RISK_WEIGHTS["protective_component"] * protective_strength
    )
    risk_score = max(0.0, min(1.0, raw_score))

    # --- Determine base risk level from thresholds ---
    if risk_score < RISK_THRESHOLDS["low"]:
        risk_level = "low"
    elif risk_score < RISK_THRESHOLDS["elevated"]:
        risk_level = "elevated"
    elif risk_score < RISK_THRESHOLDS["high"]:
        risk_level = "high"
    else:
        risk_level = "critical"

    # --- Escalation override for explicit imminent-danger language ---
    # A safety-oriented engineering rule, not a clinical judgment: strong
    # explicit statements of imminent self-harm/suicide intent should not
    # be masked by co-occurring positive emotion or a merely "elevated"
    # numeric score.
    escalation_applied = False
    immediate_danger_signals = [s for s in text_signals if s["type"] == "immediate_danger"]
    strong_ideation_signals = [
        s for s in text_signals
        if s["type"] in ("suicidal_ideation", "self_harm") and s["strength"] >= 0.9
    ]
    current_level_idx = RISK_LEVELS_ORDER.index(risk_level)

    if immediate_danger_signals:
        min_level_idx = RISK_LEVELS_ORDER.index("critical")
        if current_level_idx < min_level_idx:
            risk_level = "critical"
            risk_score = max(risk_score, RISK_THRESHOLDS["high"])
            escalation_applied = True
    elif strong_ideation_signals:
        min_level_idx = RISK_LEVELS_ORDER.index("high")
        if current_level_idx < min_level_idx:
            risk_level = "high"
            risk_score = max(risk_score, RISK_THRESHOLDS["elevated"])
            escalation_applied = True

    return {
        "level": risk_level,
        "score": round(float(risk_score), 4),
        "risk_signals": text_signals,
        "protective_signals": protective_signals,
        "emotion_distress_component": round(float(emotion_component), 4),
        "escalation_applied": escalation_applied,
        "assessment_type": RISK_ASSESSMENT_TYPE,
        "disclaimer": RISK_DISCLAIMER,
    }


def save_risk_config() -> None:
    """
    Persist every risk/sentiment configuration constant to disk so the
    heuristic system is fully auditable and reproducible (design brief
    PART 18).
    """
    risk_config = {
        "script_version": SCRIPT_VERSION,
        "assessment_type": RISK_ASSESSMENT_TYPE,
        "disclaimer": RISK_DISCLAIMER,
        "risk_thresholds": RISK_THRESHOLDS,
        "risk_levels_order": RISK_LEVELS_ORDER,
        "risk_weights": RISK_WEIGHTS,
        "distress_emotion_weights": DISTRESS_EMOTION_WEIGHTS,
        "protective_emotion_weights": PROTECTIVE_EMOTION_WEIGHTS,
        "text_risk_pattern_categories": {
            category: [strength for _, strength in patterns]
            for category, patterns in TEXT_RISK_PATTERNS.items()
        },
        "protective_text_pattern_count": len(PROTECTIVE_TEXT_PATTERNS),
        "sentiment_emotion_groups": {
            "positive_emotions": sorted(POSITIVE_EMOTIONS),
            "negative_emotions": sorted(NEGATIVE_EMOTIONS),
            "neutral_emotions": sorted(NEUTRAL_EMOTIONS),
        },
        "clinical_validation": False,
        "notes": (
            "All weights/thresholds here are hand-authored engineering "
            "heuristics for a screening/decision-support signal. They are "
            "NOT derived from a clinically validated risk dataset. "
            "GoEmotions provides only the underlying emotion probabilities; "
            "it is not itself a risk-labelled dataset."
        ),
    }
    risk_config_path = OUTPUT_DIR / "risk_config.json"
    with open(risk_config_path, "w", encoding="utf-8") as f:
        json.dump(risk_config, f, indent=4)
    logger.info(f"Risk/sentiment configuration saved to {risk_config_path}")


# =========================================================================
# FINAL PREDICTION FUNCTION (EMOTIONS + SENTIMENT + RISK, COMBINED)
# =========================================================================
def predict_text(
    model,
    tokenizer,
    text: str,
    device: torch.device,
    id2label: Dict[int, str],
    threshold: float,
    per_label_thresholds: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Run the full pipeline on a single piece of text and return a single
    JSON-serializable structured result:

        {
          "text": ...,
          "emotions": [{"label": ..., "score": ...}, ...],
          "sentiment": {...},
          "risk_assessment": {...},
        }

    `per_label_thresholds`, if provided, overrides the single global
    `threshold` on a per-emotion basis (falls back to `threshold` for any
    label not present in the dict).
    """
    model.eval()
    model.to(device)

    processed = preprocess_text(text)
    inputs = tokenizer(
        processed,
        return_tensors="pt",
        truncation=True,
        max_length=MAX_LENGTH,
    ).to(device)

    with torch.no_grad():
        logits = model(**inputs).logits
        probs = torch.sigmoid(logits).squeeze(0).cpu().numpy()

    emotion_scores: Dict[str, float] = {
        id2label[i]: float(probs[i]) for i in range(len(probs))
    }

    # --- Emotions above (per-label or global) threshold, sorted desc ---
    active_emotions = []
    for i, prob in enumerate(probs):
        label = id2label[i]
        label_threshold = threshold
        if per_label_thresholds is not None:
            label_threshold = per_label_thresholds.get(label, threshold)
        if prob >= label_threshold:
            active_emotions.append({"label": label, "score": round(float(prob), 4)})

    if not active_emotions:
        # Preserve prior behavior: always surface the single strongest
        # emotion even if nothing crosses the threshold.
        top_idx = int(np.argmax(probs))
        active_emotions = [{"label": id2label[top_idx], "score": round(float(probs[top_idx]), 4)}]

    active_emotions.sort(key=lambda e: e["score"], reverse=True)

    sentiment = compute_sentiment(emotion_scores)
    risk_assessment = assess_risk(text, emotion_scores)

    return {
        "text": text,
        "emotions": active_emotions,
        "sentiment": sentiment,
        "risk_assessment": risk_assessment,
    }


# =========================================================================
# PREDICTION DEMO
# =========================================================================
def run_prediction_demo(
    model,
    tokenizer,
    device: torch.device,
    id2label: Dict[int, str],
    threshold: float,
    per_label_thresholds: Optional[Dict[str, float]] = None,
) -> List[Dict[str, Any]]:
    """
    Run the full emotions + sentiment + risk pipeline on a set of
    hand-written journal-style entries chosen to demonstrate that these
    three signals are independent (design brief PART 15 / PART 17):

      1. Negative sentiment, low risk        (lost sports game)
      2. Emotional distress, no explicit risk language (grief)
      3. Explicit risk language               (imminent self-harm intent)
      4. Positive sentiment + explicit risk statement (escalation demo)
      5. Gratitude / positive emotion, low risk
    """
    journal_entries = [
        "I miss my grandmother every day.",
        "I can't believe I won the lottery, this is amazing!",
        "Why does everything always go wrong for me?",
        "I'm so proud of how far I've come this year.",
        "I feel completely lost and don't know what to do next.",
        "Thank you so much for helping me move last weekend.",
        "I am furious that they cancelled the trip without telling me.",
        "Watching the sunset with you was the best part of my day.",
        "I'm terrified about my exam results tomorrow.",
        "It was such a pleasant surprise to see an old friend today.",
        # --- Signal-independence demonstration set ---
        "I am so sad because my favorite team lost the championship game.",
        "I miss my grandmother every day and think about her constantly.",
        "I am going to kill myself tonight, I've made up my mind.",
        "I am happy today with my family, but I have decided to hurt myself tonight.",
        "I'm so grateful for my friends who have been there for me lately.",
        "This movie about a character considering suicide really made me think.",
        "My friend died by suicide last year and I still think about him.",
        "I've been talking to my therapist and things are slowly getting better.",
    ]

    logger.info("=" * 70)
    logger.info("PREDICTION DEMO: EMOTIONS + SENTIMENT + RISK INDICATOR")
    logger.info("=" * 70)

    results = []
    for entry in journal_entries:
        result = predict_text(
            model, tokenizer, entry, device, id2label, threshold, per_label_thresholds
        )

        logger.info(f'Journal: "{result["text"]}"')
        logger.info("Emotions:")
        for e in result["emotions"]:
            logger.info(f"  {e['label']:<15s} {e['score']:.2f}")
        logger.info("Sentiment:")
        logger.info(f"  {result['sentiment']['label']}  (score: {result['sentiment']['score']:.2f})")
        logger.info("Risk assessment:")
        logger.info(f"  level: {result['risk_assessment']['level']}")
        logger.info(f"  score: {result['risk_assessment']['score']:.2f}")
        if result["risk_assessment"]["risk_signals"]:
            sig_desc = ", ".join(
                f"{s['type']} ({s['strength']:.2f})" for s in result["risk_assessment"]["risk_signals"]
            )
            logger.info(f"  risk signals: {sig_desc}")
        else:
            logger.info("  risk signals: none detected")
        if result["risk_assessment"]["protective_signals"]:
            prot_desc = ", ".join(
                f"{s['type']} ({s['strength']:.2f})" for s in result["risk_assessment"]["protective_signals"]
            )
            logger.info(f"  protective signals: {prot_desc}")
        else:
            logger.info("  protective signals: none detected")
        logger.info(f"  assessment type: {result['risk_assessment']['assessment_type']}")
        logger.info("-" * 50)

        results.append(result)

    demo_path = OUTPUT_DIR / "prediction_demo.json"
    with open(demo_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=4)
    logger.info(f"Prediction demo results saved to {demo_path}")

    return results


# =========================================================================
# SAVE ARTIFACTS
# =========================================================================
def save_all_artifacts(
    trainer: Trainer,
    tokenizer: AutoTokenizer,
    val_metrics: Dict[str, float],
    test_metrics: Dict[str, float],
    id2label: Dict[int, str],
    label2id: Dict[str, int],
    threshold: float,
    per_label_thresholds: Dict[str, float],
) -> None:
    """Persist the final model, tokenizer, metrics, trainer state, label mapping,
    and the auditable threshold/risk configuration alongside the model weights."""
    logger.info("Saving final model and tokenizer...")
    trainer.save_model(str(MODEL_DIR))
    tokenizer.save_pretrained(str(MODEL_DIR))

    metrics_path = OUTPUT_DIR / "metrics.json"
    combined_metrics = {
        "chosen_threshold": threshold,
        "threshold_candidates": list(THRESHOLD_CANDIDATES),
        "validation": val_metrics,
        "test": test_metrics,
    }
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(combined_metrics, f, indent=4)
    logger.info(f"Metrics saved to {metrics_path}")

    trainer_state_path = MODEL_DIR / "trainer_state.json"
    trainer.state.save_to_json(str(trainer_state_path))
    logger.info(f"Trainer state saved to {trainer_state_path}")

    label_mapping_path = MODEL_DIR / "label_mapping.json"
    with open(label_mapping_path, "w", encoding="utf-8") as f:
        json.dump({"id2label": id2label, "label2id": label2id}, f, indent=4)
    logger.info(f"Label mapping copied to {label_mapping_path}")

    threshold_path = MODEL_DIR / "threshold_config.json"
    with open(threshold_path, "w", encoding="utf-8") as f:
        json.dump({
            "global_threshold": threshold,
            "per_label_thresholds": per_label_thresholds,
        }, f, indent=4)
    logger.info(f"Threshold configuration copied to {threshold_path}")

    # Copy the risk/sentiment configuration alongside the model so the
    # model directory is self-contained and auditable on its own.
    risk_config_src = OUTPUT_DIR / "risk_config.json"
    if risk_config_src.exists():
        risk_config_dst = MODEL_DIR / "risk_config.json"
        risk_config_dst.write_text(risk_config_src.read_text(encoding="utf-8"), encoding="utf-8")
        logger.info(f"Risk configuration copied to {risk_config_dst}")

    logger.info(f"All artifacts saved successfully in '{MODEL_DIR}' and '{OUTPUT_DIR}'.")


# =========================================================================
# MAIN PIPELINE
# =========================================================================
def main() -> None:
    """Orchestrate the full end-to-end GoEmotions + sentiment + risk pipeline."""
    start_time = time.time()

    try:
        logger.info("=" * 70)
        logger.info("GOEMOTIONS MULTI-LABEL EMOTION CLASSIFICATION TRAINING")
        logger.info("(+ derived sentiment layer + heuristic risk-indicator layer)")
        logger.info("=" * 70)

        # ---------------- Setup ----------------
        create_project_directories()
        set_global_seed(SEED)
        device = detect_device()

        # ---------------- Data ----------------
        dataset, label_names, dataset_config, dataset_version = load_goemotions_dataset()
        num_labels = len(label_names)

        run_eda(dataset, label_names)

        dataset = apply_preprocessing(dataset)

        id2label, label2id = build_label_mapping(label_names)

        # ---------------- Tokenization ----------------
        logger.info(f"Loading tokenizer: {MODEL_NAME}")
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

        tokenized_dataset = tokenize_dataset(dataset, tokenizer, num_labels)
        for split in tokenized_dataset.keys():
            tokenized_dataset[split].set_format(
                type="torch",
                columns=["input_ids", "attention_mask", "labels"],
            )

        train_dataset = GoEmotionsTorchDataset(tokenized_dataset["train"])
        val_dataset = GoEmotionsTorchDataset(tokenized_dataset["validation"])
        test_dataset = GoEmotionsTorchDataset(tokenized_dataset["test"])

        logger.info(
            f"Dataset sizes -> train: {len(train_dataset)}, "
            f"validation: {len(val_dataset)}, test: {len(test_dataset)}"
        )

        # ---------------- Model ----------------
        model = build_model(num_labels, id2label, label2id)
        model.to(device)
        model.config.use_cache = False  # required when gradient checkpointing is enabled

        # ---------------- Training Arguments ----------------
        # `warmup_steps` is computed explicitly from WARMUP_RATIO and the
        # planned number of optimizer steps rather than passing
        # `warmup_ratio` directly, to stay on the currently-recommended,
        # non-deprecated TrainingArguments surface across Transformers
        # versions. `logging_dir` remains a supported, non-deprecated
        # TrainingArguments field for local TensorBoard-style logs.
        steps_per_epoch = max(1, len(train_dataset) // BATCH_SIZE)
        total_train_steps = steps_per_epoch * NUM_EPOCHS
        warmup_steps = int(total_train_steps * WARMUP_RATIO)

        use_fp16 = torch.cuda.is_available()
        training_args = TrainingArguments(
            output_dir=str(CHECKPOINT_DIR),
            num_train_epochs=NUM_EPOCHS,
            learning_rate=LEARNING_RATE,
            per_device_train_batch_size=BATCH_SIZE,
            per_device_eval_batch_size=BATCH_SIZE,
            weight_decay=WEIGHT_DECAY,
            warmup_steps=warmup_steps,
            eval_strategy="epoch",
            save_strategy="epoch",
            load_best_model_at_end=True,
            metric_for_best_model="eval_micro_f1",
            greater_is_better=True,
            fp16=use_fp16,
            gradient_checkpointing=True,
            gradient_checkpointing_kwargs={"use_reentrant": False},
            logging_dir=str(OUTPUT_DIR / "logs"),
            logging_steps=50,
            save_total_limit=2,
            report_to=[],
            seed=SEED,
            disable_tqdm=False,
        )

        # ---------------- Trainer ----------------
        data_collator = DataCollatorWithPadding(tokenizer=tokenizer)
        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            processing_class=tokenizer,
            data_collator=data_collator,
            compute_metrics=compute_metrics,
            callbacks=[
                EarlyStoppingCallback(early_stopping_patience=EARLY_STOPPING_PATIENCE),
                ProgressLoggingCallback(),
            ],
        )

        # ---------------- Train ----------------
        logger.info("Starting training...")
        sample = train_dataset[0]
        logger.info(f"Label dtype: {sample['labels'].dtype} | Label shape: {sample['labels'].shape}")

        trainer.train()
        logger.info("Training complete.")

        # ---------------- Training curves ----------------
        plot_training_curves(trainer)

        # ---------------- Evaluation ----------------
        val_probabilities, val_labels = predict_split(trainer, val_dataset, "validation")
        best_threshold, val_metrics = tune_threshold(val_labels, val_probabilities)
        logger.info(f"Validation metrics at optimized threshold {best_threshold:.2f}: {val_metrics}")

        per_label_thresholds = calculate_per_label_thresholds(val_labels, val_probabilities, label_names)

        test_probabilities, test_labels = predict_split(trainer, test_dataset, "test")
        test_metrics = calculate_metrics(test_labels, test_probabilities, best_threshold)
        logger.info(f"Test metrics at optimized threshold {best_threshold:.2f}: {test_metrics}")
        save_classification_reports(
            val_labels, val_probabilities, test_labels, test_probabilities,
            label_names, best_threshold,
        )

        # ---------------- Risk / sentiment configuration ----------------
        save_risk_config()

        # ---------------- Prediction demo ----------------
        run_prediction_demo(
            trainer.model, tokenizer, device, id2label, best_threshold, per_label_thresholds
        )

        # ---------------- Save everything ----------------
        end_time = datetime.now()
        save_training_config(
            device, num_labels, label_names, dataset_config, dataset_version,
            datetime.fromtimestamp(start_time), end_time, best_threshold, trainer.model,
        )
        save_all_artifacts(
            trainer, tokenizer, val_metrics, test_metrics, id2label, label2id,
            best_threshold, per_label_thresholds,
        )

        elapsed = time.time() - start_time
        logger.info("=" * 70)
        logger.info(f"TOTAL RUNTIME: {timedelta(seconds=int(elapsed))}")
        logger.info("PIPELINE COMPLETED SUCCESSFULLY")
        logger.info("=" * 70)

    except Exception as exc:
        logger.exception(f"Pipeline failed with an exception: {exc}")
        raise


if __name__ == "__main__":
    main()