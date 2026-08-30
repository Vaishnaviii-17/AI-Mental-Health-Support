# 🧠 AI Mental Health Support System

An AI-powered web application designed to support mental well-being by providing mood tracking, journaling, personalized mental health insights, and an AI chatbot for emotional support. The platform aims to promote mental wellness through secure, user-friendly, and data-driven features.

This project is being developed as a **Final Year B.Tech Computer Engineering Project** using a modern full-stack architecture with **React, Express.js, PostgreSQL, and Prisma ORM**.

---

## 📌 Project Objectives

- Promote mental health awareness and self-care.
- Provide a secure platform for users to monitor their emotional well-being.
- Allow users to maintain a private journal and mood history.
- Generate AI-powered recommendations based on user interactions.
- Provide anonymous access for users who prefer privacy.
- Build a scalable and production-ready web application.

---

# ✨ Features

### Authentication
- Secure User Registration
- Secure Login
- JWT Authentication
- Password Hashing using bcrypt
- Anonymous Login
- Google Authentication *(Planned)*

### Mental Health
- Daily Mood Tracking
- Mood History
- Personal Journal
- English, Hindi, and Marathi Voice Journaling with Whisper Speech-to-Text
- AI Mental Health Chatbot
- Personalized Recommendations
- Mental Health Resources

### Dashboard
- Mood Analytics
- Progress Tracking
- Charts and Graphs
- User Profile

### Security
- JWT Authentication
- Password Encryption
- Environment Variables
- Rate Limiting
- Secure API Design

---

# 🛠️ Tech Stack

| Category | Technology |
|-----------|------------|
| Frontend | React.js, Vite |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| ORM | Prisma ORM |
| Authentication | JWT, bcrypt |
| API Communication | Axios |
| Charts | Chart.js |
| Styling | CSS / Tailwind CSS |
| Version Control | Git & GitHub |

---

# 📂 Project Structure

```
AI-Mental-Health-Support/
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── package-lock.json
│
├── backend/
│   ├── prisma/
│   ├── src/
│   ├── package.json
│   └── package-lock.json
│
├── .env.example
├── .gitignore
└── README.md
```

---

# 🚀 Getting Started

## 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/AI-Mental-Health-Support.git
cd AI-Mental-Health-Support
```

---

## 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

---

## 3. Install Backend Dependencies

```bash
cd ../backend
npm install
```

---

# ⚙️ Environment Variables

Create a `.env` file in the project root by copying `.env.example`.

Example:

```env
PORT=5000
NODE_ENV=development

DATABASE_URL="postgresql://username:password@localhost:5432/mental_health_db"

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:5173

GEMINI_API_KEY=your_api_key
```

---

# 🗄️ Database Setup

Install PostgreSQL and create a database.

Generate Prisma Client

```bash
npx prisma generate
```

Run database migrations

```bash
npx prisma migrate dev
```

(Optional)

Open Prisma Studio

```bash
npx prisma studio
```

---

# ▶️ Running the Project

## Start Backend

```bash
cd backend
npm run dev
```

Backend runs at

```
http://localhost:5000
```

---

## Start Python AI Service

The Python service runs the existing GoEmotions journal analysis at
`POST /predict` and the Whisper transcription endpoint at `POST /transcribe`.

```bash
cd backend/python
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python inference_server.py
```

AI service runs at

```text
http://127.0.0.1:5001
```

Configure the Node backend with:

```env
ML_INFERENCE_URL=http://127.0.0.1:5001
```

---

## Start Frontend

```bash
cd frontend
npm run dev
```

Frontend runs at

```
http://localhost:5173
```

---

# Voice Journaling

Voice journaling is an additional input method for the existing journal form.
It does not replace typed journals or the GoEmotions analysis pipeline.
Supported journal languages are English (`en`), Hindi (`hi`), and Marathi
(`mr`). The original journal text is always preserved in the language the user
spoke or typed.

```text
Voice
  |
  v
Whisper
  |
  v
Original Language Text
  |
  v
Translation (hi/mr only)
  |
  v
English Analysis Text
  |
  v
GoEmotions
  |
  v
Database
```

For English journals, the original text is analyzed directly. For Hindi and
Marathi journals, the backend translates the text to English first, sends only
that English analysis text to GoEmotions/risk analysis, and stores the original
language text in `journals.content`.

The journal table stores:

- `content`: original user text
- `original_language`: `en`, `hi`, or `mr`
- `translated_content`: English translation for Hindi/Marathi entries

Whisper settings are centralized in environment variables:

```env
WHISPER_MODEL_SIZE=tiny.en
WHISPER_LANGUAGE=en
WHISPER_DEVICE=auto
WHISPER_COMPUTE_TYPE=int8
TRANSCRIPTION_MAX_AUDIO_BYTES=10485760
TRANSCRIPTION_TIMEOUT_MS=60000
```

The default model is `tiny.en`, chosen for local development speed and lower
resource use. Hindi and Marathi require a multilingual Whisper model, so set
`WHISPER_MODEL_SIZE` to `tiny`, `base`, `small`, `medium`, or `large` when
testing those languages.

Translation is server-side only and is configured through environment variables:

```env
TRANSLATION_PROVIDER=auto
TRANSLATION_TIMEOUT_MS=20000
TRANSLATION_API_KEY=
LIBRETRANSLATE_URL=
GEMINI_TRANSLATION_MODEL=gemini-1.5-flash
```

`TRANSLATION_PROVIDER=auto` uses LibreTranslate when `LIBRETRANSLATE_URL` is
set, otherwise Gemini when `GEMINI_API_KEY` is configured. You can also set
`TRANSLATION_PROVIDER=libretranslate`, `gemini`, or `disabled` explicitly. If a
Hindi or Marathi entry cannot be translated, the journal is not saved and the
English-only analysis model is not run on untranslated text.

Audio privacy handling:

- Browser audio is uploaded only for transcription.
- Node keeps the upload in memory and does not write an audio file.
- The Python service writes a temporary file only for Whisper processing.
- Temporary audio is deleted in a cleanup block after success or failure.
- Audio files, audio URLs, and raw recordings are not stored in PostgreSQL.

Manual transcription smoke test:

```bash
cd backend/python
python test_transcription.py path\to\sample-audio.webm --language hi
```

Suggested samples: short English, Hindi, and Marathi sentences, multiple
sentences, normal speaking speed, pauses, and Indian English pronunciation. The
repository does not include voice recordings because journal audio is sensitive.

---

# 🔐 Authentication

The application uses:

- JWT Authentication
- bcrypt Password Hashing
- Protected API Routes
- Anonymous Login
- Google OAuth *(Planned)*

---

# 📊 Planned Modules

- User Authentication
- Anonymous Login
- Mood Tracker
- Daily Journal
- AI Chatbot
- Dashboard
- Mood Analytics
- Recommendation Engine
- Mental Health Resources
- User Profile
- Notifications *(Future)*
- Therapist Booking *(Future)*
- Emergency Support *(Future)*

---

# 🌱 Future Enhancements

- AI Emotion Detection
- Voice-based Mental Health Assistant
- Video Consultation
- Mobile Application
- Email Verification
- Password Reset
- Push Notifications
- Multi-language Support
- Admin Dashboard
- Cloud Deployment

---

# 🤝 Git Workflow

Each team member should create a separate feature branch before making changes.

Example:

```bash
git checkout -b feature/postgresql-backend
```

After completing the work:

```bash
git add .
git commit -m "Add PostgreSQL backend"
git push origin feature/postgresql-backend
```

Create a Pull Request and request a review before merging into the `main` branch.

---

# 👥 Contributors

- Aarti Sakpal
- Esha Pawar
- Khushboo Yadav
- Vaishnavi Sawant
---

# 📄 License

This project is developed for academic and educational purposes as part of a Final Year B.Tech Computer Engineering project.

Unauthorized commercial use is not permitted.

---

# 📧 Support

For questions, suggestions, or contributions, please create an issue in this repository or contact the project maintainers.

---

## ⭐ Acknowledgements

- React.js
- Node.js
- Express.js
- PostgreSQL
- Prisma ORM
- Chart.js
- GitHub
- OpenAI / Google Gemini APIs (planned integration)
