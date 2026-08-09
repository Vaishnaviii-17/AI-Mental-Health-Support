"""
train_emotion.py
=================

AI Mental Health Support System - Emotion Detection Model Training Script.

This script trains a distilroberta-base text classification model on the
dair-ai/emotion dataset to detect one of six emotions from free-text input
(e.g. journal entries). This model is intended to be integrated into a MERN
application as the "Emotion Detection" microservice.

IMPORTANT: This is ONLY the emotion detection model. It is NOT the mental
health risk-assessment model.

Classes:
    0 -> sadness
    1 -> joy
    2 -> love
    3 -> anger
    4 -> fear
    5 -> surprise

Pipeline:
    1. Environment setup (seeds, device, directories)
    2. Dataset loading (dair-ai/emotion)
    3. Exploratory Data Analysis (EDA)
    4. Visualizations
    5. Text preprocessing
    6. Tokenization
    7. Model construction (distilroberta-base)
    8. Training via Hugging Face Trainer API
    9. Evaluation (validation + test)
    10. Confusion matrix + classification report
    11. Training history plots
    12. Model persistence
    13. Sample predictions
    14. Final summary

Run:
    python train_emotion.py
"""

# ==========================================================
# 1. IMPORTS
# ==========================================================

# --- Standard library ---
import os
import json
import random
import re
import time
import logging
import glob
from datetime import datetime
from typing import Dict, List, Tuple, Any, Optional

# --- Third-party: numerical / data ---
import numpy as np
import pandas as pd

# --- Third-party: visualization ---
import matplotlib
matplotlib.use("Agg")  # Ensure plots are never displayed, only saved.
import matplotlib.pyplot as plt
import seaborn as sns

# --- Third-party: ML / NLP ---
import torch
from datasets import load_dataset, Dataset, DatasetDict
import evaluate
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
    classification_report,
)
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    DataCollatorWithPadding,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback,
)

# ==========================================================
# LOGGING SETUP
# ==========================================================

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("train_emotion")


# ==========================================================
# 2. GLOBAL CONFIGURATION
# ==========================================================

MODEL_NAME: str = "distilroberta-base"
OUTPUT_DIR: str = "outputs"
MODEL_SAVE_PATH: str = os.path.join("models", "emotion_model")
MAX_LENGTH: int = 128
BATCH_SIZE: int = 16
LEARNING_RATE: float = 2e-5
EPOCHS: int = 4
WEIGHT_DECAY: float = 0.01
WARMUP_RATIO: float = 0.1
LR_SCHEDULER_TYPE: str = "linear"
SEED: int = 42

DEVICE: torch.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

LABEL_NAMES: List[str] = ["sadness", "joy", "love", "anger", "fear", "surprise"]
NUM_LABELS: int = len(LABEL_NAMES)
ID2LABEL: Dict[int, str] = {i: name for i, name in enumerate(LABEL_NAMES)}
LABEL2ID: Dict[str, int] = {name: i for i, name in enumerate(LABEL_NAMES)}


def print_device_info() -> None:
    """Print information about the compute device being used for training."""
    logger.info("=" * 60)
    logger.info("DEVICE CONFIGURATION")
    logger.info("=" * 60)
    logger.info(f"CUDA available : {torch.cuda.is_available()}")
    logger.info(f"Selected device: {DEVICE}")
    if torch.cuda.is_available():
        logger.info(f"GPU name       : {torch.cuda.get_device_name(0)}")
        logger.info(
            f"GPU memory     : "
            f"{torch.cuda.get_device_properties(0).total_memory / (1024 ** 3):.2f} GB"
        )
    else:
        logger.info("Training will run on CPU. This may be slow.")
    logger.info("=" * 60)


# ==========================================================
# 3. RANDOM SEED
# ==========================================================

def set_seed(seed: int = SEED) -> None:
    """
    Set random seeds across all relevant libraries to ensure
    reproducible results.

    Args:
        seed: The seed value to use everywhere.
    """
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)
    logger.info(f"Random seed set to {seed} for Python, NumPy, and Torch.")


# ==========================================================
# 4. CREATE DIRECTORIES
# ==========================================================

def create_directories() -> None:
    """Create the required output and model directories if they don't exist."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(MODEL_SAVE_PATH, exist_ok=True)
    logger.info(f"Ensured directory exists: {OUTPUT_DIR}/")
    logger.info(f"Ensured directory exists: {MODEL_SAVE_PATH}/")


# ==========================================================
# 5. LOAD DATASET
# ==========================================================

def load_emotion_dataset() -> DatasetDict:
    """
    Load the dair-ai/emotion dataset (the 'split' / 6-class configuration)
    using the Hugging Face `datasets` library.

    Returns:
        A DatasetDict with 'train', 'validation', and 'test' splits.
    """
    logger.info("Loading dataset: dair-ai/emotion ...")
    try:
        dataset = load_dataset("dair-ai/emotion", "split")
    except Exception as exc:
        logger.warning(f"Failed to load 'split' config ({exc}); trying default config.")
        dataset = load_dataset("dair-ai/emotion")

    logger.info("Dataset loaded successfully.")
    logger.info(f"Dataset structure:\n{dataset}")
    logger.info(f"Train rows      : {len(dataset['train'])}")
    logger.info(f"Validation rows : {len(dataset['validation'])}")
    logger.info(f"Test rows       : {len(dataset['test'])}")
    return dataset


# ==========================================================
# 6. DATASET EXPLORATION (EDA)
# ==========================================================

def dataset_to_dataframe(dataset_split: Dataset) -> pd.DataFrame:
    """
    Convert a Hugging Face Dataset split into a pandas DataFrame and
    map integer labels to human-readable emotion names.

    Args:
        dataset_split: A single split of the dataset (e.g. dataset['train']).

    Returns:
        A pandas DataFrame with columns ['text', 'label', 'emotion'].
    """
    df = dataset_split.to_pandas()
    df["emotion"] = df["label"].map(ID2LABEL)
    return df


def explore_dataset(dataset: DatasetDict) -> pd.DataFrame:
    """
    Perform exploratory data analysis (EDA) on the training split and
    print a comprehensive summary to the console.

    Args:
        dataset: The full DatasetDict (train/validation/test).

    Returns:
        The training split converted to a pandas DataFrame (used later
        for visualizations).
    """
    logger.info("=" * 60)
    logger.info("EXPLORATORY DATA ANALYSIS (EDA)")
    logger.info("=" * 60)

    train_df = dataset_to_dataframe(dataset["train"])

    logger.info(f"Dataset shape (train): {train_df.shape}")
    logger.info(f"Column names          : {list(train_df.columns)}")
    logger.info(f"Label names           : {LABEL_NAMES}")

    logger.info("\nFirst five samples:")
    print(train_df.head(5).to_string())

    logger.info("\nRandom five samples:")
    print(train_df.sample(5, random_state=SEED).to_string())

    missing_values = train_df.isnull().sum()
    logger.info(f"\nMissing values per column:\n{missing_values}")

    duplicate_count = train_df["text"].duplicated().sum()
    logger.info(f"\nDuplicate texts found: {duplicate_count}")

    logger.info("\nEmotion distribution (counts):")
    distribution = train_df["emotion"].value_counts()
    print(distribution.to_string())

    logger.info("\nEmotion distribution (percentage):")
    percentage = train_df["emotion"].value_counts(normalize=True) * 100
    print(percentage.round(2).to_string())

    max_class = distribution.max()
    min_class = distribution.min()
    imbalance_ratio = max_class / min_class if min_class > 0 else float("inf")
    logger.info(f"\nClass imbalance ratio (max/min): {imbalance_ratio:.2f}")

    logger.info("=" * 60)
    return train_df


# ==========================================================
# 7. VISUALIZATIONS
# ==========================================================

def plot_emotion_distribution(df: pd.DataFrame) -> None:
    """Save a bar chart of raw emotion counts."""
    plt.figure(figsize=(8, 6))
    sns.countplot(
        data=df,
        x="emotion",
        order=df["emotion"].value_counts().index,
        hue="emotion",
        legend=False,
        palette="viridis",
    )
    plt.title("Emotion Distribution (Counts) - Training Set", fontsize=14)
    plt.xlabel("Emotion")
    plt.ylabel("Count")
    plt.tight_layout()
    save_path = os.path.join(OUTPUT_DIR, "emotion_distribution.png")
    plt.savefig(save_path, dpi=150)
    plt.close()
    logger.info(f"Saved figure: {save_path}")


def plot_emotion_percentage(df: pd.DataFrame) -> None:
    """Save a pie chart of emotion class percentages."""
    plt.figure(figsize=(8, 8))
    counts = df["emotion"].value_counts()
    colors = sns.color_palette("viridis", len(counts))
    plt.pie(
        counts.values,
        labels=counts.index,
        autopct="%1.1f%%",
        startangle=90,
        colors=colors,
    )
    plt.title("Emotion Distribution (Percentage) - Training Set", fontsize=14)
    plt.tight_layout()
    save_path = os.path.join(OUTPUT_DIR, "emotion_percentage.png")
    plt.savefig(save_path, dpi=150)
    plt.close()
    logger.info(f"Saved figure: {save_path}")


def plot_word_count_distribution(df: pd.DataFrame) -> None:
    """Save a histogram of word counts per text sample."""
    word_counts = df["text"].apply(lambda x: len(str(x).split()))
    plt.figure(figsize=(8, 6))
    sns.histplot(word_counts, bins=30, kde=True, color="teal")
    plt.title("Word Count Distribution", fontsize=14)
    plt.xlabel("Number of Words")
    plt.ylabel("Frequency")
    plt.tight_layout()
    save_path = os.path.join(OUTPUT_DIR, "word_count_distribution.png")
    plt.savefig(save_path, dpi=150)
    plt.close()
    logger.info(f"Saved figure: {save_path}")


def plot_sentence_length_distribution(df: pd.DataFrame) -> None:
    """Save a histogram of character-level sentence lengths."""
    char_lengths = df["text"].apply(lambda x: len(str(x)))
    plt.figure(figsize=(8, 6))
    sns.histplot(char_lengths, bins=30, kde=True, color="darkorange")
    plt.title("Sentence Length Distribution (Characters)", fontsize=14)
    plt.xlabel("Number of Characters")
    plt.ylabel("Frequency")
    plt.tight_layout()
    save_path = os.path.join(OUTPUT_DIR, "sentence_length_distribution.png")
    plt.savefig(save_path, dpi=150)
    plt.close()
    logger.info(f"Saved figure: {save_path}")


def generate_visualizations(df: pd.DataFrame) -> None:
    """Generate and save all EDA visualizations."""
    logger.info("Generating visualizations...")
    sns.set_theme(style="whitegrid")
    plot_emotion_distribution(df)
    plot_emotion_percentage(df)
    plot_word_count_distribution(df)
    plot_sentence_length_distribution(df)
    logger.info("All visualizations saved to outputs/.")


# ==========================================================
# 8. TEXT PREPROCESSING
# ==========================================================

URL_PATTERN = re.compile(r"http\S+|www\.\S+")
HTML_PATTERN = re.compile(r"<.*?>")
WHITESPACE_PATTERN = re.compile(r"\s+")


def preprocess_text(text: str) -> str:
    """
    Clean a single raw text string for model consumption.

    Steps:
        1. Lowercase the text.
        2. Remove URLs.
        3. Remove HTML tags.
        4. Collapse multiple whitespace characters into one.
        5. Strip leading/trailing whitespace.

    Punctuation is intentionally preserved because BERT-family
    tokenizers make use of punctuation as meaningful sub-tokens.

    Args:
        text: The raw input string.

    Returns:
        The cleaned string.
    """
    if text is None:
        return ""
    text = str(text)
    text = text.lower()
    text = URL_PATTERN.sub(" ", text)
    text = HTML_PATTERN.sub(" ", text)
    text = WHITESPACE_PATTERN.sub(" ", text).strip()
    return text


def apply_preprocessing(dataset: DatasetDict) -> DatasetDict:
    """
    Apply `preprocess_text` to the 'text' column of every split
    (train/validation/test) in the dataset.

    Args:
        dataset: The raw DatasetDict.

    Returns:
        A new DatasetDict with cleaned text.
    """
    logger.info("Applying text preprocessing to train/validation/test splits...")

    def _clean_batch(batch: Dict[str, List[str]]) -> Dict[str, List[str]]:
        return {"text": [preprocess_text(t) for t in batch["text"]]}

    cleaned = dataset.map(_clean_batch, batched=True)
    logger.info("Text preprocessing complete.")
    return cleaned


# ==========================================================
# 9. TOKENIZER
# ==========================================================

def load_tokenizer() -> AutoTokenizer:
    """Load the model's tokenizer."""
    logger.info(f"Loading tokenizer for '{MODEL_NAME}'...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    logger.info("Tokenizer loaded successfully.")
    return tokenizer


def tokenize_dataset(dataset: DatasetDict, tokenizer: AutoTokenizer) -> DatasetDict:
    """
    Tokenize the text field of every split in the dataset.

    Args:
        dataset: Preprocessed DatasetDict.
        tokenizer: A Hugging Face tokenizer instance.

    Returns:
        A tokenized DatasetDict ready for the Trainer API.
    """
    logger.info("Tokenizing train/validation/test splits...")

    def _tokenize_batch(batch: Dict[str, List[str]]) -> Dict[str, Any]:
        # Dynamic padding: padding is left to DataCollatorWithPadding at
        # batch-collation time rather than padded to a fixed length here.
        # This reduces wasted compute on shorter sequences.
        return tokenizer(
            batch["text"],
            padding=False,
            truncation=True,
            max_length=MAX_LENGTH,
        )

    tokenized = dataset.map(_tokenize_batch, batched=True)

    # Rename 'label' to 'labels' for the Trainer API if needed and set format.
    columns_to_keep = ["input_ids", "attention_mask", "label"]
    tokenized = tokenized.rename_column("label", "labels")
    tokenized.set_format(
        type="torch",
        columns=["input_ids", "attention_mask", "labels"],
    )
    logger.info("Tokenization complete.")
    return tokenized


# ==========================================================
# 10. MODEL
# ==========================================================

def load_model() -> AutoModelForSequenceClassification:
    """
    Load a sequence classification model (distilroberta-base) configured for
    6-class emotion classification.

    Returns:
        The instantiated model, moved to DEVICE.
    """
    logger.info(f"Loading model '{MODEL_NAME}' for sequence classification...")
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=NUM_LABELS,
        id2label=ID2LABEL,
        label2id=LABEL2ID,
    )
    model.to(DEVICE)
    logger.info("Model loaded and moved to device.")
    return model


# ==========================================================
# 11. DATA COLLATOR
# ==========================================================

def build_data_collator(tokenizer: AutoTokenizer) -> DataCollatorWithPadding:
    """Build a dynamic padding data collator."""
    return DataCollatorWithPadding(tokenizer=tokenizer)


# ==========================================================
# 12. METRICS
# ==========================================================

def compute_metrics(eval_pred) -> Dict[str, float]:
    """
    Compute accuracy, precision, recall, weighted F1, and macro F1
    for a batch of model predictions.

    Args:
        eval_pred: A tuple (logits, labels) provided by the Trainer.

    Returns:
        A dictionary of metric name -> value.
    """
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)

    accuracy = accuracy_score(labels, predictions)
    precision_w, recall_w, f1_w, _ = precision_recall_fscore_support(
        labels, predictions, average="weighted", zero_division=0
    )
    _, _, f1_macro, _ = precision_recall_fscore_support(
        labels, predictions, average="macro", zero_division=0
    )

    return {
        "accuracy": accuracy,
        "precision": precision_w,
        "recall": recall_w,
        "f1": f1_w,
        "f1_macro": f1_macro,
    }


# ==========================================================
# 13. TRAINING ARGUMENTS
# ==========================================================

def build_training_arguments() -> TrainingArguments:
    """Construct the TrainingArguments object for the Trainer."""
    return TrainingArguments(
        output_dir=OUTPUT_DIR,
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_strategy="steps",
        logging_steps=50,
        learning_rate=LEARNING_RATE,
        per_device_train_batch_size=BATCH_SIZE,
        per_device_eval_batch_size=BATCH_SIZE,
        num_train_epochs=EPOCHS,
        weight_decay=WEIGHT_DECAY,
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        greater_is_better=True,
        save_total_limit=2,
        report_to="none",
        seed=SEED,
        fp16=torch.cuda.is_available(),
        warmup_ratio=WARMUP_RATIO,
        lr_scheduler_type=LR_SCHEDULER_TYPE,
        max_grad_norm=1.0,
        disable_tqdm=False,
    )


# ==========================================================
# 14. EARLY STOPPING
# ==========================================================

def build_early_stopping_callback(patience: int = 2) -> EarlyStoppingCallback:
    """Build an early stopping callback with the given patience."""
    return EarlyStoppingCallback(early_stopping_patience=patience)


# ==========================================================
# 15. TRAINER
# ==========================================================

def build_trainer(
    model: AutoModelForSequenceClassification,
    args: TrainingArguments,
    train_dataset: Dataset,
    eval_dataset: Dataset,
    tokenizer: AutoTokenizer,
    data_collator: DataCollatorWithPadding,
) -> Trainer:
    """Construct the Hugging Face Trainer object."""
    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        processing_class=tokenizer,
        data_collator=data_collator,
        compute_metrics=compute_metrics,
        callbacks=[build_early_stopping_callback(patience=2)],
    )
    return trainer


# ==========================================================
# 16. TRAIN MODEL
# ==========================================================

def find_latest_checkpoint(output_dir: str) -> Optional[str]:
    """
    Look for existing 'checkpoint-*' directories inside output_dir so that
    training can be resumed automatically if it was previously interrupted.

    Args:
        output_dir: The Trainer's output directory.

    Returns:
        The path to the most recent checkpoint directory, or None if no
        checkpoint exists.
    """
    checkpoints = glob.glob(os.path.join(output_dir, "checkpoint-*"))
    if not checkpoints:
        return None
    # Sort by the numeric step suffix so the most recent checkpoint is last.
    checkpoints.sort(key=lambda path: int(path.split("-")[-1]))
    latest = checkpoints[-1]
    logger.info(f"Found existing checkpoint: {latest}")
    return latest


def train_model(trainer: Trainer) -> Tuple[Any, float]:
    """
    Train the model and report total training time. If a checkpoint from
    a previously interrupted run is found in OUTPUT_DIR, training resumes
    from that checkpoint automatically.

    Args:
        trainer: A configured Trainer instance.

    Returns:
        A tuple of (train_result, elapsed_time_in_seconds).
    """
    logger.info("=" * 60)
    logger.info("STARTING TRAINING")
    logger.info("=" * 60)

    resume_checkpoint = find_latest_checkpoint(OUTPUT_DIR)
    if resume_checkpoint:
        logger.info(f"Resuming training from checkpoint: {resume_checkpoint}")
    else:
        logger.info("No existing checkpoint found. Starting training from scratch.")

    start_time = time.time()

    train_result = trainer.train(resume_from_checkpoint=resume_checkpoint)

    elapsed = time.time() - start_time
    logger.info(f"Training complete. Total training time: {elapsed:.2f} seconds "
                f"({elapsed / 60:.2f} minutes).")
    return train_result, elapsed


# ==========================================================
# 17. EVALUATE
# ==========================================================

def evaluate_model(trainer: Trainer, dataset_split: Dataset, split_name: str) -> Dict[str, float]:
    """
    Evaluate the trained model on a given dataset split and print results.

    Args:
        trainer: The Trainer with the trained model loaded.
        dataset_split: The tokenized dataset split to evaluate on.
        split_name: A human-readable name for logging (e.g. 'Validation').

    Returns:
        A dictionary of evaluation metrics.
    """
    logger.info(f"Evaluating model on {split_name} set...")
    metrics = trainer.evaluate(eval_dataset=dataset_split)
    logger.info(f"--- {split_name} Metrics ---")
    logger.info(f"Accuracy : {metrics.get('eval_accuracy', float('nan')):.4f}")
    logger.info(f"Precision: {metrics.get('eval_precision', float('nan')):.4f}")
    logger.info(f"Recall   : {metrics.get('eval_recall', float('nan')):.4f}")
    logger.info(f"F1 (wt.) : {metrics.get('eval_f1', float('nan')):.4f}")
    logger.info(f"F1 (macro): {metrics.get('eval_f1_macro', float('nan')):.4f}")
    return metrics


# ==========================================================
# 18. CONFUSION MATRIX
# ==========================================================

def generate_confusion_matrix(trainer: Trainer, test_dataset: Dataset) -> np.ndarray:
    """
    Predict on the test set and save a confusion matrix heatmap.

    Args:
        trainer: The trained Trainer instance.
        test_dataset: The tokenized test split.

    Returns:
        The predicted labels array (for reuse in classification report).
    """
    logger.info("Generating predictions on test set for confusion matrix...")
    predictions_output = trainer.predict(test_dataset)
    y_true = predictions_output.label_ids
    y_pred = np.argmax(predictions_output.predictions, axis=-1)

    cm = confusion_matrix(y_true, y_pred)

    plt.figure(figsize=(8, 6))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=LABEL_NAMES,
        yticklabels=LABEL_NAMES,
    )
    plt.title("Confusion Matrix - Test Set", fontsize=14)
    plt.xlabel("Predicted Label")
    plt.ylabel("True Label")
    plt.tight_layout()
    save_path_png = os.path.join(OUTPUT_DIR, "confusion_matrix.png")
    save_path_pdf = os.path.join(OUTPUT_DIR, "confusion_matrix.pdf")
    plt.savefig(save_path_png, dpi=150)
    plt.savefig(save_path_pdf)
    plt.close()
    logger.info(f"Saved figure: {save_path_png}")
    logger.info(f"Saved figure: {save_path_pdf}")

    return y_true, y_pred


# ==========================================================
# 19. CLASSIFICATION REPORT
# ==========================================================

def save_classification_report(y_true: np.ndarray, y_pred: np.ndarray) -> None:
    """
    Generate a sklearn classification report and save it as a text file.

    Args:
        y_true: Ground-truth labels.
        y_pred: Predicted labels.
    """
    report = classification_report(
        y_true, y_pred, target_names=LABEL_NAMES, zero_division=0
    )
    save_path = os.path.join(OUTPUT_DIR, "classification_report.txt")
    with open(save_path, "w", encoding="utf-8") as f:
        f.write("CLASSIFICATION REPORT - TEST SET\n")
        f.write("=" * 60 + "\n")
        f.write(report)
    logger.info(f"Saved classification report: {save_path}")
    logger.info(f"\n{report}")


# ==========================================================
# 20. TRAINING HISTORY
# ==========================================================

def plot_training_history(trainer: Trainer) -> None:
    """
    Extract training logs from the Trainer's log history and plot
    training/validation loss and evaluation accuracy over epochs.

    Args:
        trainer: The trained Trainer instance.
    """
    logger.info("Extracting training history from trainer logs...")
    log_history = trainer.state.log_history
    history_df = pd.DataFrame(log_history)

    # --- Loss curve ---
    plt.figure(figsize=(8, 6))
    if "loss" in history_df.columns:
        train_logs = history_df.dropna(subset=["loss"])
        plt.plot(train_logs["step"], train_logs["loss"], label="Training Loss", color="royalblue")
    if "eval_loss" in history_df.columns:
        eval_logs = history_df.dropna(subset=["eval_loss"])
        plt.plot(eval_logs["step"], eval_logs["eval_loss"], label="Validation Loss",
                  color="crimson", marker="o")
    plt.title("Training and Validation Loss", fontsize=14)
    plt.xlabel("Step")
    plt.ylabel("Loss")
    plt.legend()
    plt.tight_layout()
    loss_path = os.path.join(OUTPUT_DIR, "loss_curve.png")
    plt.savefig(loss_path, dpi=150)
    plt.close()
    logger.info(f"Saved figure: {loss_path}")

    # --- Accuracy curve ---
    plt.figure(figsize=(8, 6))
    if "eval_accuracy" in history_df.columns:
        eval_logs = history_df.dropna(subset=["eval_accuracy"])
        plt.plot(
            eval_logs["step"],
            eval_logs["eval_accuracy"],
            label="Validation Accuracy",
            color="seagreen",
            marker="o",
        )
    plt.title("Evaluation Accuracy Over Training", fontsize=14)
    plt.xlabel("Step")
    plt.ylabel("Accuracy")
    plt.legend()
    plt.tight_layout()
    acc_path = os.path.join(OUTPUT_DIR, "accuracy_curve.png")
    plt.savefig(acc_path, dpi=150)
    plt.close()
    logger.info(f"Saved figure: {acc_path}")

    # --- Precision / Recall / F1 curves (only if logged by the Trainer) ---
    metric_curve_specs = [
        ("eval_precision", "Validation Precision", "precision_curve.png", "darkorange"),
        ("eval_recall", "Validation Recall", "recall_curve.png", "purple"),
        ("eval_f1", "Validation F1 Score", "f1_curve.png", "teal"),
    ]
    for metric_key, label, filename, color in metric_curve_specs:
        if metric_key not in history_df.columns:
            continue
        metric_logs = history_df.dropna(subset=[metric_key])
        if metric_logs.empty:
            continue
        plt.figure(figsize=(8, 6))
        plt.plot(metric_logs["step"], metric_logs[metric_key], label=label,
                  color=color, marker="o")
        plt.title(label + " Over Training", fontsize=14)
        plt.xlabel("Step")
        plt.ylabel(label)
        plt.legend()
        plt.tight_layout()
        metric_path = os.path.join(OUTPUT_DIR, filename)
        plt.savefig(metric_path, dpi=150)
        plt.close()
        logger.info(f"Saved figure: {metric_path}")


# ==========================================================
# 21. SAVE MODEL
# ==========================================================

def save_model_artifacts(
    trainer: Trainer,
    tokenizer: AutoTokenizer,
    val_metrics: Dict[str, float],
    test_metrics: Dict[str, float],
    training_time: float,
) -> None:
    """
    Persist the trained model, tokenizer, label mappings, and metrics
    to disk under MODEL_SAVE_PATH.

    Args:
        trainer: The trained Trainer instance (holds the best model).
        tokenizer: The tokenizer used during training.
        val_metrics: Validation set metrics.
        test_metrics: Test set metrics.
        training_time: Total training time in seconds.
    """
    logger.info(f"Saving model and tokenizer to '{MODEL_SAVE_PATH}'...")
    trainer.save_model(MODEL_SAVE_PATH)
    tokenizer.save_pretrained(MODEL_SAVE_PATH)

    label_mappings = {"id2label": ID2LABEL, "label2id": LABEL2ID}
    with open(os.path.join(MODEL_SAVE_PATH, "label_mappings.json"), "w", encoding="utf-8") as f:
        json.dump(label_mappings, f, indent=4)

    metrics_summary = {
        "validation": {k: float(v) for k, v in val_metrics.items() if isinstance(v, (int, float))},
        "test": {k: float(v) for k, v in test_metrics.items() if isinstance(v, (int, float))},
        "training_time_seconds": training_time,
        "config": {
            "model_name": MODEL_NAME,
            "max_length": MAX_LENGTH,
            "batch_size": BATCH_SIZE,
            "learning_rate": LEARNING_RATE,
            "epochs": EPOCHS,
            "weight_decay": WEIGHT_DECAY,
            "warmup_ratio": WARMUP_RATIO,
            "lr_scheduler_type": LR_SCHEDULER_TYPE,
            "seed": SEED,
        },
    }

    metrics_path_model = os.path.join(MODEL_SAVE_PATH, "metrics.json")
    with open(metrics_path_model, "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=4)

    metrics_path_output = os.path.join(OUTPUT_DIR, "metrics.json")
    with open(metrics_path_output, "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=4)

    logger.info(f"Saved model artifacts to: {MODEL_SAVE_PATH}")
    logger.info(f"Saved metrics.json to: {metrics_path_model} and {metrics_path_output}")


def save_training_config() -> None:
    """
    Save a training_config.json file to outputs/ documenting the
    hyperparameters and environment used for this training run.
    """
    config = {
        "model_name": MODEL_NAME,
        "batch_size": BATCH_SIZE,
        "learning_rate": LEARNING_RATE,
        "epochs": EPOCHS,
        "weight_decay": WEIGHT_DECAY,
        "max_length": MAX_LENGTH,
        "warmup_ratio": WARMUP_RATIO,
        "lr_scheduler_type": LR_SCHEDULER_TYPE,
        "seed": SEED,
        "training_datetime": datetime.now().isoformat(timespec="seconds"),
        "device": str(DEVICE),
    }
    save_path = os.path.join(OUTPUT_DIR, "training_config.json")
    with open(save_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=4)
    logger.info(f"Saved training configuration: {save_path}")


# ==========================================================
# 22. SAMPLE PREDICTIONS
# ==========================================================

SAMPLE_JOURNAL_ENTRIES: List[str] = [
    "I feel so alone today, like nobody understands what I'm going through.",
    "I got the promotion I've been working towards for years, I can't stop smiling!",
    "Spending the evening with my partner made my heart feel so full.",
    "I can't believe they lied to me again, I'm absolutely furious right now.",
    "I keep thinking something terrible is going to happen to my family.",
    "I never expected to see my old best friend at the airport today!",
    "Today was just an ordinary day, nothing special happened at all.",
    "I've been crying myself to sleep every night this week.",
    "Watching my daughter graduate filled me with so much joy and pride.",
    "The strange noise outside my window at 3am left me shaking with fear.",
]


def predict_sample_texts(
    model: AutoModelForSequenceClassification,
    tokenizer: AutoTokenizer,
    texts: List[str],
) -> None:
    """
    Run inference on a list of sample journal entries and print the
    predicted emotion, confidence, and top-3 probabilities for each.

    Args:
        model: The trained model.
        tokenizer: The tokenizer used for training.
        texts: A list of raw text strings to classify.
    """
    logger.info("=" * 60)
    logger.info("SAMPLE PREDICTIONS ON JOURNAL ENTRIES")
    logger.info("=" * 60)

    model.eval()
    model.to(DEVICE)

    for raw_text in texts:
        cleaned = preprocess_text(raw_text)
        inputs = tokenizer(
            cleaned,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=MAX_LENGTH,
        ).to(DEVICE)

        with torch.no_grad():
            outputs = model(**inputs)
            probabilities = torch.softmax(outputs.logits, dim=-1).squeeze().cpu().numpy()

        predicted_id = int(np.argmax(probabilities))
        predicted_label = ID2LABEL[predicted_id]
        confidence = float(probabilities[predicted_id])

        top3_indices = np.argsort(probabilities)[::-1][:3]
        top3 = [(ID2LABEL[i], float(probabilities[i])) for i in top3_indices]

        print(f"\nJournal Entry     : {raw_text}")
        print(f"Predicted Emotion : {predicted_label}")
        print(f"Confidence        : {confidence:.4f}")
        print("Top 3 Probabilities:")
        for label, prob in top3:
            print(f"    {label:<10}: {prob:.4f}")

    logger.info("=" * 60)


# ==========================================================
# 23. FINAL SUMMARY
# ==========================================================

def print_final_summary(
    test_metrics: Dict[str, float],
    training_time: float,
) -> None:
    """Print a final human-readable summary of the training run."""
    logger.info("=" * 60)
    logger.info("TRAINING COMPLETE")
    logger.info("=" * 60)
    logger.info(f"Model Path    : {os.path.abspath(MODEL_SAVE_PATH)}")
    logger.info(f"Output Folder : {os.path.abspath(OUTPUT_DIR)}")
    logger.info(f"Test Accuracy : {test_metrics.get('eval_accuracy', float('nan')):.4f}")
    logger.info(f"Test F1 Score : {test_metrics.get('eval_f1', float('nan')):.4f}")
    logger.info(f"Training Time : {training_time:.2f} seconds ({training_time / 60:.2f} minutes)")
    logger.info("=" * 60)


# ==========================================================
# MAIN PIPELINE
# ==========================================================

def main() -> None:
    """Run the full emotion-detection training pipeline end to end."""
    try:
        # --- Setup ---
        set_seed(SEED)
        print_device_info()
        create_directories()
        save_training_config()

        # --- Data loading & EDA ---
        raw_dataset = load_emotion_dataset()
        train_df = explore_dataset(raw_dataset)
        generate_visualizations(train_df)

        # --- Preprocessing & tokenization ---
        cleaned_dataset = apply_preprocessing(raw_dataset)
        tokenizer = load_tokenizer()
        tokenized_dataset = tokenize_dataset(cleaned_dataset, tokenizer)

        # --- Model setup ---
        model = load_model()
        data_collator = build_data_collator(tokenizer)
        training_args = build_training_arguments()

        trainer = build_trainer(
            model=model,
            args=training_args,
            train_dataset=tokenized_dataset["train"],
            eval_dataset=tokenized_dataset["validation"],
            tokenizer=tokenizer,
            data_collator=data_collator,
        )

        # --- Train ---
        _, training_time = train_model(trainer)

        # --- Evaluate ---
        val_metrics = evaluate_model(trainer, tokenized_dataset["validation"], "Validation")
        test_metrics = evaluate_model(trainer, tokenized_dataset["test"], "Test")

        # --- Confusion matrix & classification report ---
        y_true, y_pred = generate_confusion_matrix(trainer, tokenized_dataset["test"])
        save_classification_report(y_true, y_pred)

        # --- Training history plots ---
        plot_training_history(trainer)

        # --- Save model artifacts ---
        save_model_artifacts(trainer, tokenizer, val_metrics, test_metrics, training_time)

        # --- Sample predictions ---
        predict_sample_texts(model, tokenizer, SAMPLE_JOURNAL_ENTRIES)

        # --- Final summary ---
        print_final_summary(test_metrics, training_time)

    except Exception as exc:
        logger.exception(f"Training pipeline failed with an exception: {exc}")
        raise


if __name__ == "__main__":
    main()