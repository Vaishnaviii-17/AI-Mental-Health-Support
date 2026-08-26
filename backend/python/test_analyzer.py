from conversation.analyzer import ConversationAnalyzer
from conversation.state import ConversationState


def main():

    analyzer = ConversationAnalyzer()

    state = ConversationState()

    messages = [
        "I'm scared that I will fail my exams.",
        "My parents will be disappointed in me.",
        "They keep comparing me with my cousin.",
        "I feel like I'm not good enough.",
    ]

    for message in messages:

        print("\n")
        print("=" * 75)
        print("USER:")
        print(message)

        try:

            result, state = analyzer.process(
                message,
                state
            )

            print("\n--- ANALYSIS ---")

            print("Topic:", result["topic"])
            print(
                "Topic confidence:",
                result["topic_confidence"]
            )

            print(
                "Topic classification:",
                result["topic_classification"]
            )

            print(
                "Previous topic:",
                result["previous_topic"]
            )

            print(
                "Topic changed:",
                result["topic_changed"]
            )

            print(
                "Emotion:",
                result["emotion"]
            )

            print(
                "Emotion probability:",
                result["emotion_probability"]
            )

            print(
                "Previous emotion:",
                result["previous_emotion"]
            )

            print(
                "Emotion changed:",
                result["emotion_changed"]
            )

            print(
                "Turn:",
                result["turn_count"]
            )

            print("\nRisk:")
            print(result["risk"])

        except Exception as e:

            print("\nERROR:")
            print(type(e).__name__, e)

            raise


if __name__ == "__main__":
    main()