import json
from pathlib import Path

from sentence_transformers import SentenceTransformer
from sentence_transformers.util import cos_sim


class SemanticService:

    def __init__(self):

        print("Loading Sentence Transformer...")

        self.model = SentenceTransformer("all-MiniLM-L6-v2")

        # Locate contexts.json
        base_dir = Path(__file__).resolve().parent.parent
        context_file = base_dir / "context" / "contexts.json"

        with open(context_file, "r", encoding="utf-8") as file:
            self.contexts = json.load(file)

        # Store examples
        self.context_names = []
        self.context_examples = []
        self.example_topics = []

        for topic, data in self.contexts.items():

            for example in data["examples"]:

                self.context_names.append(topic)
                self.context_examples.append(example)
                self.example_topics.append(topic)

        print(
            f"Creating embeddings for "
            f"{len(self.context_examples)} semantic examples..."
        )

        self.context_embeddings = self.model.encode(
            self.context_examples,
            convert_to_tensor=True,
            normalize_embeddings=True
        )

        # Keep unique topic names
        self.topics = list(self.contexts.keys())

        print("Semantic model ready.")

    def encode(self, text):

        return self.model.encode(
            text,
            convert_to_tensor=True,
            normalize_embeddings=True
        )

    def detect_context(
        self,
        text,
        threshold=0.45,
        margin=0.05
    ):
        """
        Detect the semantic topic of a user message.

        threshold:
            Minimum similarity required to accept a topic.

        margin:
            Minimum difference between the best and second-best
            topic before we consider the classification reliable.
        """

        user_embedding = self.encode(text)

        similarities = cos_sim(
            user_embedding,
            self.context_embeddings
        )[0]

        # ---------------------------------------------------------
        # Find best similarity for each topic
        # ---------------------------------------------------------

        topic_scores = {}

        for topic in self.topics:

            topic_indices = [
                i
                for i, example_topic
                in enumerate(self.example_topics)
                if example_topic == topic
            ]

            scores = [
                similarities[i].item()
                for i in topic_indices
            ]

            # Best matching example represents this topic
            topic_scores[topic] = max(scores)

        # ---------------------------------------------------------
        # Sort topics by score
        # ---------------------------------------------------------

        sorted_topics = sorted(
            topic_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )

        best_topic = sorted_topics[0][0]
        best_score = sorted_topics[0][1]

        second_score = (
            sorted_topics[1][1]
            if len(sorted_topics) > 1
            else 0.0
        )

        score_margin = best_score - second_score

        # ---------------------------------------------------------
        # Find the example that produced the best score
        # ---------------------------------------------------------

        best_example_index = max(
            [
                i
                for i, example_topic
                in enumerate(self.example_topics)
                if example_topic == best_topic
            ],
            key=lambda i: similarities[i].item()
        )

        best_example = self.context_examples[best_example_index]

        # ---------------------------------------------------------
        # Determine whether classification is reliable
        # ---------------------------------------------------------

        if best_score < threshold:
            classification = "out_of_domain"
            detected_topic = None
        elif score_margin < margin:
            classification = "ambiguous"
            detected_topic = None
        else:
            classification = "clear"
            detected_topic = best_topic

        return {
          "topic": detected_topic,

          "similarity": round(best_score, 4),

          "classification": classification,

          "margin": round(score_margin, 4),

          "matched_example": best_example,

           "topic_scores": {
              topic: round(score, 4)
              for topic, score in sorted_topics
    }
}