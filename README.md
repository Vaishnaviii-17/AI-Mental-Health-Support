# Frontend Setup

Frontend application for the AI-Based Mental Health Support System.

## Tech Stack

* React.js
* Vite
* React Router DOM
* Axios
* Chart.js
* React Icons

## Project Structure

```text
src/
│
├── assets/
├── components/
├── context/
├── hooks/
├── pages/
├── routes/
├── services/
├── utils/
│
├── App.jsx
└── main.jsx
```

## Installation

1. Clone the repository

```bash
git clone <repository-url>
```

2. Navigate to frontend folder

```bash
cd frontend
```

3. Install dependencies

```bash
npm install
```

4. Start development server

```bash
npm run dev
```

The application will run on:

```text
http://localhost:5173
```

## Available Scripts

### Start Development Server

```bash
npm run dev
```

### Build Project

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Features

* User Authentication
* Dashboard
* Mood Check-In
* AI Chat Support
* Mood History Analytics
* Journal Management
* Recommendations
* Health Status Tracking
* Crisis Support
* Focus Timer

## Environment Variables

Create a `.env` file inside the frontend directory.

Example:

```env
VITE_API_URL=http://localhost:5000
```

## Team Guidelines

* Follow component-based architecture.
* Keep reusable UI inside `components/`.
* Keep API calls inside `services/`.
* Keep page-level views inside `pages/`.
* Create feature branches before development.
* Do not commit `.env` files.

## Project

MindEase – AI-Based Mental Health Support System
