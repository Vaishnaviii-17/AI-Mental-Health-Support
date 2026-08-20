"""
Manual transcription smoke test.

Usage:
    python test_transcription.py path/to/sample-english-audio.webm

The repository intentionally does not include voice recordings. Use a short
local English sample recorded from the browser or another trusted source.
"""
import argparse
import json

from inference.transcription_service import TranscriptionService


def main():
    parser = argparse.ArgumentParser(description="Test Whisper transcription.")
    parser.add_argument("audio_path", help="Path to a local English audio file")
    args = parser.parse_args()

    service = TranscriptionService()
    result = service.transcribe(args.audio_path)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
