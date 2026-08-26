import sys
from pathlib import Path


# ---------------------------------------------------------
# Make backend/python available for importing inference
# ---------------------------------------------------------

PYTHON_DIR = Path(__file__).resolve().parent.parent

if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))


from inference.predictor import MentalHealthPredictor


class EmotionService:

    def __init__(self):

        print("Loading Mental Health Predictor...")

        self.predictor = MentalHealthPredictor()

        print("Emotion service ready.")

    # -----------------------------------------------------
    # Analyze emotion
    # -----------------------------------------------------

    def analyze(self, text):

        if not isinstance(text, str):
            raise ValueError("text must be a string")

        text = text.strip()

        if not text:
            raise ValueError("text cannot be empty")

        result = self.predictor.analyze(text)

        # ---------------------------------------------
        # Extract dominant emotion
        # ---------------------------------------------

        emotion_data = result.get("emotion", {})

        emotion = emotion_data.get("label")

        probability = emotion_data.get("probability")

        # ---------------------------------------------
        # Extract GoEmotions details
        # ---------------------------------------------

        goemotions = result.get("goemotions", {})

        emotion_scores = goemotions.get(
            "probabilities",
            {}
        )

        # ---------------------------------------------
        # Return normalized result
        # ---------------------------------------------

        return {
            "emotion": emotion,

            "probability": probability,

            "emotion_scores": emotion_scores,

            "source": emotion_data.get(
                "source",
                "goemotions"
            ),

            "reflection": result.get(
                "reflection"
            ),

            "sentiment": result.get(
                "sentiment"
            ),

            "risk": result.get(
                "risk"
            )
        }