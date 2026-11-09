# Studywise Student AI Assistant

A React chat-history interface backed by a Flask API, SQLAlchemy models, and SQLite. The project is divided into `frontend/` and `backend/`.

## Install dependencies

```sh
cd frontend
npm install
cd ../backend
pip install -r requirements.txt
```

## Run locally

Start Flask in one terminal:

```sh
cd backend
python -m app
```

Start the React client in another terminal:

```sh
cd frontend
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`). Vite proxies `/api` calls to Flask on port 5000.

To connect an assistant webhook, copy `backend/.env.example` to `backend/.env` and set `MAKE_WEBHOOK_URL`. If API-key authentication is enabled on the Make custom webhook, set `MAKE_WEBHOOK_API_KEY` to that key; Flask sends it in the `x-make-apikey` header. Keep both values server-side and never put the key in frontend code. After changing `backend/.env`, restart Flask. Without a webhook, messages still persist and the backend returns a setup notice.

The SQLAlchemy models are in `backend/models.py`. They define `Conversation` and `Message` tables with a cascading relationship. The SQLite database is stored at `backend/chat-history.sqlite` and initialized automatically when Flask starts.

Build the frontend from `frontend/` with `npm run build`.
