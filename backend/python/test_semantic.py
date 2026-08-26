from services.semantic_service import SemanticService


def main():

    service = SemanticService()

    test_messages = [

        # Academics
        "I have been staying up late because of my college workload.",

        # Family
        "At home I constantly feel like my parents expect me to be like someone else.",

        # Relationships
        "I feel hurt because someone I was close to has been avoiding me.",

        # Future
        "I have no idea what I am going to do once I finish my degree.",

        # Self
        "Lately I keep doubting whether I am capable enough.",

        # Work
        "My office responsibilities have become too difficult to manage.",

        # Ambiguous
        "Everything has been getting too much lately.",

        # Ambiguous/general
        "I don't know what is happening to me.",

        # Completely unrelated
        "What is the capital of France?",

        # Academics - new
        "I am struggling to keep up with my university classes.",

        # Work - new
        "My boss keeps giving me more responsibilities.",

        # Relationship - new
        "I feel ignored by someone who is important to me."
    ]

    for message in test_messages:

        result = service.detect_context(message)

        print("\n" + "=" * 70)

        print("USER:")
        print(message)

        print("\nCLASSIFICATION:")
        print(result["classification"])

        print("TOPIC:")
        print(result["topic"])

        print("SIMILARITY:")
        print(result["similarity"])

        print("MARGIN:")
        print(result["margin"])

        print("MATCHED EXAMPLE:")
        print(result["matched_example"])

        print("\nTOPIC SCORES:")

        for topic, score in result["topic_scores"].items():
            print(f"  {topic:15} → {score}")


if __name__ == "__main__":
    main()