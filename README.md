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

- Vaishnavi Sawant
- Team Members

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