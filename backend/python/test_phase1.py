user_message = "I'm really scared that I will fail my exams."

emotion = emotion_service.analyze(user_message)

context = semantic_service.detect_context(user_message)

state.update_emotion(...)
state.update_context(...)

state.update_response(user_message)

analysis = analyzer.analyze(state)