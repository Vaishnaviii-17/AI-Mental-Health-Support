"""
inference_server.py

Thin Flask wrapper around MentalHealthPredictor. This file was listed as
"not created" in the provided source listing, so it is materialized here
exactly as already specified -- no changes to the predictor or models.

NOTE ON LOCATION: this file lives at backend/python/inference_server.py
(a SIBLING of the `inference/` package, not inside it), because
predictor.py is imported as `from inference.predictor import
MentalHealthPredictor`. Running this file from inside backend/python/
makes `inference` resolve as a local package.
"""
from flask import Flask, request, jsonify
from inference.predictor import MentalHealthPredictor

app = Flask(__name__)

predictor = MentalHealthPredictor()

@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "service": "mental-health-inference"
    })

@app.post("/predict")
def predict():
    try:
        data = request.get_json()

        if not data:
            return jsonify({
                "error": "Request body is required"
            }), 400

        text = data.get("text")

        if not isinstance(text, str):
            return jsonify({
                "error": "text must be a string"
            }), 400

        text = text.strip()

        if not text:
            return jsonify({
                "error": "text cannot be empty"
            }), 400

        result = predictor.analyze(text)

        return jsonify(result)

    except Exception as e:
        print(f"Inference error: {type(e).__name__}: {e}")

        return jsonify({
            "error": "Inference failed"
        }), 500


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5001,
        debug=False
    )