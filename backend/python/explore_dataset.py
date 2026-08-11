from datasets import load_dataset
import pandas as pd
import matplotlib.pyplot as plt

# Load dataset
dataset = load_dataset("dair-ai/emotion")

# Convert training data to DataFrame
df = pd.DataFrame(dataset["train"])

# Emotion labels
label_names = dataset["train"].features["label"].names

# Replace numeric labels with emotion names
df["emotion"] = df["label"].map(lambda x: label_names[x])

# Basic information
print("\nDataset Shape:")
print(df.shape)

print("\nFirst Five Rows:")
print(df.head())

print("\nEmotion Distribution:")
print(df["emotion"].value_counts())

# Plot class distribution
plt.figure(figsize=(8,5))
df["emotion"].value_counts().plot(kind="bar")
plt.title("Emotion Distribution")
plt.xlabel("Emotion")
plt.ylabel("Number of Samples")
plt.tight_layout()
plt.show()