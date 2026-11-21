# ThriftLoop: app source

This folder contains the two parts of ThriftLoop:

- [`backend/`](backend): the FastAPI and SQLite REST API
- [`frontend/`](frontend): the Expo (React Native) iOS app

Setup, configuration, testing, CI/CD and the API reference are in the **[main README](../README.md)**.

## Quick start

```bash
# Backend
cd backend
python -m venv .venv && .venv/Scripts/activate   # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --timeout-keep-alive 120

# App (in a second terminal)
cd frontend
npm install
npx expo start
```
