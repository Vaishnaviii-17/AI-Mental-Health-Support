from services.emotion_service import EmotionService


def main():

    service = EmotionService()

    test_messages = [

        "I am scared that I will fail my exams.",

        "I feel really sad because my best friend stopped talking to me.",

        "My parents keep comparing me with my cousin.",

        "I am extremely angry about what happened.",

        "I feel happy today because I achieved something important."
    ]

    for message in test_messages:

        print("\n" + "=" * 70)

        print("USER:")
        print(message)

        result = service.analyze(message)

        print("\nDOMINANT EMOTION:")
        print(result["emotion"])

        print("\nPROBABILITY:")
        print(result["probability"])

        print("\nSOURCE:")
        print(result["source"])

        print("\nEMOTION SCORES:")
        print(result["emotion_scores"])

        print("\nSENTIMENT:")
        print(result["sentiment"])

        print("\nRISK:")
        print(result["risk"])


if __name__ == "__main__":
    main()