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
  -> editable journal textarea
  -> existing Save Entry / GoEmotions flow
```

Audio is temporary. Express keeps the uploaded file in memory, and the Python
service deletes its temporary Whisper input file after processing.

Install Python AI dependencies:

```bash
cd backend/python
pip install -r requirements.txt
python inference_server.py
```

Manual transcription test:

```bash
cd backend/python
python test_transcription.py path\to\sample-english-audio.webm
```

English is the only supported transcription language right now. Hindi and
Marathi are reserved for future work.

## Team

AI-Based Mental Health Support System
