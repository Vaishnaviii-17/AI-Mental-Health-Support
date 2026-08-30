# Backend

Backend service for the AI-Based Mental Health Support System.

## Overview

This backend provides REST APIs for:

* User Authentication
* Mood Tracking
* Journal Management
* AI Chat Integration
* Recommendations Engine
* Health Status Analytics

## Tech Stack

* Node.js
* Express.js
* PostgreSQL
* JWT Authentication
* bcryptjs
* dotenv
* express-rate-limit
* Python AI service for GoEmotions analysis and Whisper transcription

## Project Structure

```text
backend/
│
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── utils/
│
├── server.js
├── .env
├── .env.example
├── package.json
└── README.md
```

## Installation

Clone the repository and navigate to the backend directory:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

## Running the Server

Development mode:

```bash
npm run dev
```

Server URL:

```text
http://localhost:5000
```

## Current Status

* [x] Initial Backend Setup
* [x] PostgreSQL Connection
* [x] Authentication APIs
* [x] Mood APIs
* [x] Journal APIs
* [ ] Chat APIs
* [x] AI Engine Integration
* [ ] Deployment

## Voice Journaling Transcription

The journal voice flow is:

```text
React MediaRecorder
  -> Express /api/journal/transcribe
  -> Python AI service /transcribe
  -> faster-whisper
  -> original-language editable journal textarea
  -> Save Entry
  -> server-side translation to English for hi/mr
  -> GoEmotions emotion, sentiment, and risk analysis
  -> PostgreSQL
```

Audio is temporary. Express keeps the uploaded file in memory, and the Python
service deletes its temporary Whisper input file after processing.

Supported transcription and journal languages are:

* English: `en`
* Hindi: `hi`
* Marathi: `mr`

The database preserves original text in `journals.content`. Hindi and Marathi
entries also store the English analysis translation in
`journals.translated_content`; English entries keep that field empty.

Install Python AI dependencies:

```bash
cd backend/python
pip install -r requirements.txt
python inference_server.py
```

Manual transcription test:

```bash
cd backend/python
python test_transcription.py path\to\sample-audio.webm --language mr
```

`WHISPER_MODEL_SIZE=tiny.en` preserves the existing English-only local setup.
For Hindi or Marathi, configure a multilingual faster-whisper model such as
`tiny`, `base`, `small`, `medium`, or `large`.

Translation configuration is backend-only:

```env
TRANSLATION_PROVIDER=auto
TRANSLATION_TIMEOUT_MS=20000
TRANSLATION_API_KEY=
LIBRETRANSLATE_URL=
GEMINI_TRANSLATION_MODEL=gemini-1.5-flash
```

`auto` prefers LibreTranslate when `LIBRETRANSLATE_URL` is set, then Gemini
when `GEMINI_API_KEY` is configured. If translation is unavailable for Hindi or
Marathi, journal creation returns an error instead of analyzing untranslated
text with the English-oriented model.

## Team

AI-Based Mental Health Support System
