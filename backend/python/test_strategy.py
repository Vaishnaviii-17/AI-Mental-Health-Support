from conversation.analyzer import ConversationAnalyzer
from conversation.strategy import ResponseStrategy


analyzer = ConversationAnalyzer()
strategy_engine = ResponseStrategy()

state = None


messages = [
    "I'm scared that I will fail my exams.",
    "My parents will be disappointed in me.",
    "They keep comparing me with my cousin.",
    "I feel like I'm not good enough."
]


for message in messages:

    analysis, state = analyzer.process(
        message,
        state
    )

    strategy = strategy_engine.decide(
        analysis
    )

    print("\n" + "=" * 70)

    print("USER:")
    print(message)

    print("\nTOPIC:")
    print(analysis["topic"])

    print("EMOTION:")
    print(analysis["emotion"])

    print("STRATEGY:")
    print(strategy["strategy"])

    print("REASON:")
    print(strategy["reason"])