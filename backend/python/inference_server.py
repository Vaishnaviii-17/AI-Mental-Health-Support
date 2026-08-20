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
import os
import tempfile

from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

from inference.predictor import MentalHealthPredictor
from inference.transcription_service import TranscriptionService

app = Flask(__name__)

predictor = MentalHealthPredictor()
transcription_service = TranscriptionService()

AUDIO_ALLOWED_EXTENSIONS = {"webm", "wav", "mp3", "m4a", "ogg", "mp4"}
AUDIO_ALLOWED_MIME_TYPES = {
    "audio/webm",
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/ogg",
    "video/webm",
}
AUDIO_MAX_BYTES = int(os.getenv("TRANSCRIPTION_MAX_AUDIO_BYTES", str(10 * 1024 * 1024)))


def _extension(filename):
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[1].lower()


def _validate_audio_upload(file_storage):
    if file_storage is None:
        return "audio file is required"

    filename = secure_filename(file_storage.filename or "")
    content_type = (file_storage.mimetype or "").lower()
    ext = _extension(filename)

    if ext not in AUDIO_ALLOWED_EXTENSIONS:
        return "unsupported audio file type"

    if content_type and content_type not in AUDIO_ALLOWED_MIME_TYPES:
        return "unsupported audio content type"

    return None

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


@app.post("/transcribe")
def transcribe():
    temp_path = None

    try:
        audio = request.files.get("audio")
        validation_error = _validate_audio_upload(audio)

        if validation_error:
            return jsonify({"error": validation_error}), 400

        content_length = request.content_length or 0
        if content_length > AUDIO_MAX_BYTES:
            return jsonify({"error": "audio file is too large"}), 413

        suffix = "." + _extension(audio.filename)
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            audio.save(temp_file)
            temp_path = temp_file.name

        if os.path.getsize(temp_path) <= 0:
            return jsonify({"error": "audio file is empty"}), 400

        if os.path.getsize(temp_path) > AUDIO_MAX_BYTES:
            return jsonify({"error": "audio file is too large"}), 413

        result = transcription_service.transcribe(temp_path)

        if not result.get("text"):
            return jsonify({"error": "empty transcript"}), 422

        return jsonify(result)

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"Transcription error: {type(e).__name__}: {e}")
        return jsonify({"error": "Transcription failed"}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                print("Temporary transcription audio cleanup failed.")


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5001,
        debug=False
    )
