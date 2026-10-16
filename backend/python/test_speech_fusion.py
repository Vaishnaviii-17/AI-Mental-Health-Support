import unittest

from speech_emotion.fusion import fuse_emotions


class SpeechFusionTests(unittest.TestCase):
    def test_strong_agreement_keeps_shared_mood(self):
        result = fuse_emotions(
            {"sadness": 0.85, "neutral": 0.15},
            {"sadness": 0.80, "neutral": 0.20},
        )

        self.assertEqual(result["mismatch"]["category"], "low")
        self.assertEqual(result["fusion"]["finalMood"], "sadness")

    def test_mild_disagreement_still_fuses(self):
        result = fuse_emotions(
            {"sadness": 0.60, "neutral": 0.25, "other": 0.15},
            {"sadness": 0.50, "neutral": 0.30, "other": 0.20},
        )

        self.assertIn(result["mismatch"]["category"], {"low", "moderate"})
        self.assertEqual(result["fusion"]["finalMood"], "sadness")

    def test_strong_disagreement_returns_mixed(self):
        result = fuse_emotions(
            {"sadness": 0.85, "neutral": 0.15},
            {"joy": 0.90, "neutral": 0.10},
        )

        self.assertEqual(result["mismatch"]["category"], "high")
        self.assertEqual(result["fusion"]["finalMood"], "mixed")

    def test_risk_is_not_part_of_fusion(self):
        result = fuse_emotions(
            {"sadness": 0.85, "fear": 0.10, "neutral": 0.05},
            {"joy": 0.90, "neutral": 0.10},
        )

        self.assertEqual(result["fusion"]["finalMood"], "mixed")
        self.assertNotIn("risk", result)


if __name__ == "__main__":
    unittest.main()
