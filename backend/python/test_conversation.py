from conversation.analyzer import ConversationAnalyzer


def main():

    print("Initializing conversation system...")

    # ---------------------------------------------------------
    # Create analyzer
    # ---------------------------------------------------------

    analyzer = ConversationAnalyzer()

    # ---------------------------------------------------------
    # IMPORTANT:
    # Keep the same state throughout the conversation.
    # ---------------------------------------------------------

    state = None

    conversation = [
        "I'm scared that I will fail my exams.",
        "My parents will be disappointed in me.",
        "They keep comparing me with my cousin.",
        "I feel like I'm not good enough."
    ]

    # ---------------------------------------------------------
    # Process conversation
    # ---------------------------------------------------------

    for user_text in conversation:

        print("\n" + "=" * 70)

        print("USER:")
        print(user_text)

        # -----------------------------------------------------
        # Analyzer
        # -----------------------------------------------------

        analysis, state = analyzer.process(
            user_text,
            state
        )

        # -----------------------------------------------------
        # Display analysis
        # -----------------------------------------------------

        print("\nANALYSIS:")

        print("Topic:", analysis.get("topic"))
        print(
            "Topic confidence:",
            analysis.get("topic_confidence")
        )

        print(
            "Topic classification:",
            analysis.get("topic_classification")
        )

        print(
            "Previous topic:",
            analysis.get("previous_topic")
        )

        print(
            "Emotion:",
            analysis.get("emotion")
        )

        print(
            "Emotion probability:",
            analysis.get("emotion_probability")
        )

        print(
            "Previous emotion:",
            analysis.get("previous_emotion")
        )

        print(
            "Topic changed:",
            analysis.get("topic_changed")
        )

        print(
            "Emotion changed:",
            analysis.get("emotion_changed")
        )

        print(
            "Strategy:",
            analysis.get("strategy")
        )

        print(
            "Strategy reason:",
            analysis.get("strategy_reason")
        )

        # -----------------------------------------------------
        # Response
        #
        # The analyzer already generated the response.
        # -----------------------------------------------------

        print("\nBOT:")
        print(analysis.get("response"))

        print("=" * 70)


if __name__ == "__main__":
    main()