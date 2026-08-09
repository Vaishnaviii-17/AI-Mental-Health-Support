from datasets import load_dataset

# Load the Emotion dataset
dataset = load_dataset("dair-ai/emotion")

# Show dataset information
print(dataset)

print("\nFirst Training Sample:")
print(dataset["train"][0])

print("\nLabel Information:")
print(dataset["train"].features["label"])

print("\nLabel Names:")
print(dataset["train"].features["label"].names)