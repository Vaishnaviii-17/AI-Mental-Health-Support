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
* MongoDB
* Mongoose
* JWT Authentication
* bcryptjs
* dotenv
* express-rate-limit

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
* [ ] MongoDB Connection
* [ ] Authentication APIs
* [ ] Mood APIs
* [ ] Journal APIs
* [ ] Chat APIs
* [ ] AI Engine Integration
* [ ] Deployment

## Team

AI-Based Mental Health Support System
