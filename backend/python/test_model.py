import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL_PATH = "models/emotion_model"

device = "cuda" if torch.cuda.is_available() else "cpu"

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
model.to(device)
model.eval()

labels = [
    "sadness",
    "joy",
    "love",
    "anger",
    "fear",
    "surprise"
]

print("Emotion Model Ready!")
print("Type 'quit' to exit.\n")

while True:
    text = input("You: ")

    if text.lower() == "quit":
        break

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=128
    )

    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model(**inputs)

    probs = torch.softmax(outputs.logits, dim=1)[0]
    pred = torch.argmax(probs).item()

    print(f"\nEmotion : {labels[pred]}")
    print(f"Confidence : {probs[pred]*100:.2f}%")

    print("\nTop 3 Predictions:")
    values, indices = torch.topk(probs, 3)

    for v, i in zip(values, indices):
        print(f"{labels[i]} : {v.item()*100:.2f}%")

    print("-"*40)