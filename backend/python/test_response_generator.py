from services.response_generator import ResponseGenerator


generator = ResponseGenerator()


analysis = {
    "topic": "academics",
    "emotion": "fear",
    "strategy": "reflect_and_explore",
    "risk_level": "low"
}


response = generator.generate(
    user_text="I'm scared that I will fail my exams.",
    analysis=analysis,
    conversation_history=[]
)


print("\n====================================")
print("BOT:")
print(response)
print("====================================")