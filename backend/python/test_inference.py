from inference.predictor import MentalHealthPredictor


predictor = MentalHealthPredictor()


text = "I have been feeling overwhelmed lately and I don't know how to handle everything."


result = predictor.analyze(text)


print(result)