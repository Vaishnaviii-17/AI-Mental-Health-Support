"""
inference_server.py

Flask wrapper around the Python mental-health inference system.

Endpoints:

    GET  /health
    POST /predict
    POST /chat
    POST /transcribe

/predict
    Performs analysis only:
        - emotion
        - GoEmotions
        - sentiment
        - risk

/chat
    Performs analysis + conversational response generation:
        - MentalHealthPredictor
        - ResponseGenerator
        - Hugging Face LLM
        - fallback response if Hugging Face is unavailable

/transcribe
    Audio transcription.

Node.js communicates with this server over HTTP.
"""

import os
import tempfile

from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

from inference.predictor import MentalHealthPredictor
from inference.transcription_service import TranscriptionService

# Response generator is responsible for generating the natural-language
# conversational response.
try:
    from response_generator import ResponseGenerator
except ImportError:
    ResponseGenerator = None


app = Flask(__name__)


# ============================================================
# SERVICES
# ============================================================

print("Initializing Python inference services...")

predictor = MentalHealthPredictor()
transcription_service = TranscriptionService()

response_generator = None

if ResponseGenerator is not None:
    try:
        response_generator = ResponseGenerator()
        print("Response Generator ready.")
    except Exception as e:
        print(
            f"Response Generator initialization failed: "
            f"{type(e).__name__}: {e}"
        )
else:
    print(
        "Warning: response_generator.py could not be imported. "
        "Chat responses will use a basic fallback."
    )


# ============================================================
# AUDIO CONFIGURATION
# ============================================================

AUDIO_ALLOWED_EXTENSIONS = {
    "webm",
    "wav",
    "mp3",
    "m4a",
    "ogg",
    "mp4",
}

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

AUDIO_MAX_BYTES = int(
    os.getenv(
        "TRANSCRIPTION_MAX_AUDIO_BYTES",
        str(10 * 1024 * 1024),
    )
)


# ============================================================
# HELPERS
# ============================================================

def _extension(filename):
    if "." not in filename:
        return ""

    return filename.rsplit(".", 1)[1].lower()


def _validate_audio_upload(file_storage):

    if file_storage is None:
        return "audio file is required"

    filename = secure_filename(
        file_storage.filename or ""
    )

    content_type = (
        file_storage.mimetype or ""
    ).lower()

    ext = _extension(filename)

    if ext not in AUDIO_ALLOWED_EXTENSIONS:
        return "unsupported audio file type"

    if (
        content_type
        and content_type not in AUDIO_ALLOWED_MIME_TYPES
    ):
        return "unsupported audio content type"

    return None


def _normalize_history(history):
    """
    Normalize history received from Node.

    We intentionally keep this permissive because the frontend/
    database history format may contain additional fields.
    """

    if not isinstance(history, list):
        return []

    normalized = []

    for item in history[-15:]:

        if not isinstance(item, dict):
            continue

        normalized.append(item)

    return normalized


def _extract_risk_level(analysis):
    """
    Support several possible risk result shapes.
    """

    risk = analysis.get("risk")

    if isinstance(risk, dict):

        return (
            risk.get("risk_level")
            or risk.get("level")
            or risk.get("riskLevel")
        )

    if isinstance(risk, str):
        return risk

    return (
        analysis.get("risk_level")
        or analysis.get("riskLevel")
    )


def _is_crisis(analysis):
    """
    Conservative mapping of the existing engineering risk result.

    This is NOT a clinical diagnosis.
    """

    risk_level = _extract_risk_level(analysis)

    if not risk_level:
        return False

    return str(risk_level).strip().lower() in {
        "high",
        "critical",
        "severe",
    }


def _basic_fallback_response(analysis):

    emotion = str(
        analysis.get("emotion")
        or "neutral"
    ).lower()

    topic = str(
        analysis.get("topic")
        or "unknown"
    ).lower()

    if topic == "academics" and emotion == "fear":

        return (
            "It sounds like the pressure around your exams "
            "is really weighing on you. What feels hardest "
            "about the exams right now?"
        )

    if topic == "family":

        return (
            "It sounds like your family situation is affecting "
            "you emotionally. What part of it feels hardest "
            "right now?"
        )

    if topic == "self":

        return (
            "It sounds like you're being quite hard on yourself. "
            "What has been contributing most to those feelings?"
        )

    if emotion == "fear":

        return (
            "It sounds like something is making you feel afraid. "
            "What feels most difficult right now?"
        )

    if emotion == "sadness":

        return (
            "It sounds like you're going through something "
            "difficult. What has been weighing on you the most?"
        )

    if emotion == "anxiety":

        return (
            "It sounds like there is a lot on your mind right now. "
            "What feels most overwhelming?"
        )

    return (
        "It sounds like there is a lot going on for you right now. "
        "What feels most important to talk about?"
    )


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():

    return jsonify({
        "status": "ok",
        "service": "mental-health-inference",
        "response_generator": (
            response_generator is not None
        ),
    })


# ============================================================
# ANALYSIS
# ============================================================

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

        print(
            f"Inference error: "
            f"{type(e).__name__}: {e}"
        )

        return jsonify({
            "error": "Inference failed"
        }), 500


# ============================================================
# CHAT
# ============================================================

@app.post("/chat")
def chat():

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

        history = _normalize_history(
            data.get("history", [])
        )

        # --------------------------------------------------------
        # 1. ANALYZE USER MESSAGE
        # --------------------------------------------------------

        analysis = predictor.analyze(text)

        if not isinstance(analysis, dict):
            analysis = {}

        # Make sure the raw user text is available to the
        # ResponseGenerator.
        analysis["text"] = text

        # --------------------------------------------------------
        # 2. DETERMINE CRISIS/RISK STATUS
        # --------------------------------------------------------

        is_crisis = _is_crisis(analysis)

        # --------------------------------------------------------
        # 3. GENERATE CONVERSATIONAL RESPONSE
        # --------------------------------------------------------

        generated_text = None

        if response_generator is not None:

            try:

                generated_text = (
                    response_generator.generate(
                        analysis=analysis,
                        state=None,
                    )
                )

            except Exception as e:

                print(
                    "Response generation failed: "
                    f"{type(e).__name__}: {e}"
                )

        # --------------------------------------------------------
        # 4. FINAL FALLBACK
        # --------------------------------------------------------

        if not generated_text:

            generated_text = _basic_fallback_response(
                analysis
            )

        generated_text = str(
            generated_text
        ).strip()

        if not generated_text:

            generated_text = _basic_fallback_response(
                analysis
            )

        # --------------------------------------------------------
        # 5. RETURN EVERYTHING NODE NEEDS
        # --------------------------------------------------------

        return jsonify({
            "text": generated_text,
            "message": generated_text,
            "isCrisis": is_crisis,
            "analysis": analysis,
        })

    except Exception as e:

        print(
            f"Chat inference error: "
            f"{type(e).__name__}: {e}"
        )

        return jsonify({
            "error": "Chat inference failed"
        }), 500


# ============================================================
# TRANSCRIPTION
# ============================================================

@app.post("/transcribe")
def transcribe():

    temp_path = None

    try:

        audio = request.files.get("audio")

        validation_error = _validate_audio_upload(
            audio
        )

        if validation_error:

            return jsonify({
                "error": validation_error
            }), 400

        content_length = (
            request.content_length or 0
        )

        if content_length > AUDIO_MAX_BYTES:

            return jsonify({
                "error": "audio file is too large"
            }), 413

        suffix = "." + _extension(
            audio.filename
        )

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temp_file:

            audio.save(temp_file)

            temp_path = temp_file.name

        file_size = os.path.getsize(
            temp_path
        )

        if file_size <= 0:

            return jsonify({
                "error": "audio file is empty"
            }), 400

        if file_size > AUDIO_MAX_BYTES:

            return jsonify({
                "error": "audio file is too large"
            }), 413

        result = transcription_service.transcribe(
            temp_path
        )

        if not result.get("text"):

            return jsonify({
                "error": "empty transcript"
            }), 422

        return jsonify(result)

    except ValueError as e:

        return jsonify({
            "error": str(e)
        }), 400

    except Exception as e:

        print(
            f"Transcription error: "
            f"{type(e).__name__}: {e}"
        )

        return jsonify({
            "error": "Transcription failed"
        }), 500

    finally:

        if (
            temp_path
            and os.path.exists(temp_path)
        ):

            try:

                os.remove(temp_path)

            except OSError:

                print(
                    "Temporary transcription "
                    "audio cleanup failed."
                )


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5001,
        debug=False,
    )