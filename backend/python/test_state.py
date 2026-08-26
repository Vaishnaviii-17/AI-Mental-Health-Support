from conversation.state import ConversationState


def main():

    state = ConversationState()

    # ----------------------------------------
    # Turn 1
    # ----------------------------------------

    state.add_turn(
        user_text="I'm scared that I will fail my exams.",
        topic="academics",
        topic_scores={
            "academics": 0.85,
            "work": 0.30,
            "future": 0.40
        },
        emotion="fear",
        emotion_scores={
            "fear": 0.82,
            "sadness": 0.20
        }
    )

    print("\n===== AFTER TURN 1 =====")
    print(state.to_dict())

    # ----------------------------------------
    # Turn 2
    # ----------------------------------------

    state.add_turn(
        user_text="My parents will be disappointed in me.",
        topic="family",
        topic_scores={
            "family": 0.78,
            "academics": 0.45
        },
        emotion="fear",
        emotion_scores={
            "fear": 0.75,
            "sadness": 0.30
        }
    )

    print("\n===== AFTER TURN 2 =====")
    print(state.to_dict())

    print("\n===== CHECKS =====")

    print("Current topic:", state.current_topic)
    print("Previous topic:", state.previous_topic)

    print("Current emotion:", state.current_emotion)
    print("Previous emotion:", state.previous_emotion)

    print("Topic changed:", state.topic_changed())
    print("Emotion changed:", state.emotion_changed())

    print("Turn count:", state.turn_count)

    print("\nRecent history:")

    for turn in state.get_recent_history():
        print(turn)


if __name__ == "__main__":
    main()