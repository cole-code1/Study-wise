import os
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from sqlalchemy import select

from .models import Conversation, Message, db


BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{BACKEND_DIR / 'chat-history.sqlite'}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JSON_SORT_KEYS"] = False
frontend_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_ORIGIN", "https://study-wise-3x5n.vercel.app").split(",")
    if origin.strip()
]
CORS(app, resources={r"/api/*": {"origins": frontend_origins}})
db.init_app(app)

with app.app_context():
    db.create_all()


@app.get("/api/health")
def health_check():
    return jsonify(status="ok", service="studywise-api")


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_conversation(conversation_id):
    return db.session.get(Conversation, conversation_id)


@app.get("/api/conversations")
def list_conversations():
    conversations = db.session.scalars(
        select(Conversation).order_by(Conversation.updated_at.desc(), Conversation.id.desc())
    ).all()
    return jsonify([conversation.to_dict() for conversation in conversations])


@app.post("/api/conversations")
def create_conversation():
    payload = request.get_json(silent=True) or {}
    title = payload.get("title", "")
    if not isinstance(title, str):
        return jsonify(error="Title must be text."), 400
    conversation = Conversation(title=title.strip()[:100] or "New conversation")
    db.session.add(conversation)
    db.session.commit()
    return jsonify(conversation.to_dict(include_messages=True)), 201


@app.get("/api/conversations/<int:conversation_id>")
def read_conversation(conversation_id):
    conversation = get_conversation(conversation_id)
    if conversation is None:
        return jsonify(error="Conversation not found."), 404
    return jsonify(conversation.to_dict(include_messages=True))


@app.delete("/api/conversations/<int:conversation_id>")
def delete_conversation(conversation_id):
    conversation = get_conversation(conversation_id)
    if conversation is None:
        return jsonify(error="Conversation not found."), 404
    db.session.delete(conversation)
    db.session.commit()
    return "", 204


@app.post("/api/conversations/<int:conversation_id>/messages")
def add_message(conversation_id):
    conversation = get_conversation(conversation_id)
    if conversation is None:
        return jsonify(error="Conversation not found."), 404

    payload = request.get_json(silent=True) or {}
    content = payload.get("content", "")
    if not isinstance(content, str) or not content.strip():
        return jsonify(error="Message cannot be empty."), 400
    content = content.strip()[:4000]

    is_first_message = not conversation.messages
    db.session.add(Message(role="user", content=content, conversation=conversation))
    if is_first_message and conversation.title == "New conversation":
        conversation.title = content[:54]
    conversation.updated_at = utc_now()
    db.session.flush()

    reply = "Your message is saved. Add MAKE_WEBHOOK_URL to .env to connect the student assistant."
    webhook_url = os.getenv("MAKE_WEBHOOK_URL")
    if webhook_url:
        try:
            webhook_headers = {}
            webhook_api_key = os.getenv("MAKE_WEBHOOK_API_KEY")
            if webhook_api_key:
                webhook_headers["x-make-apikey"] = webhook_api_key
            webhook_response = requests.post(
                webhook_url,
                json={"message": content},
                headers=webhook_headers,
                timeout=20,
            )
            webhook_response.raise_for_status()
            reply = webhook_response.text.strip() or "I received your message. What would you like to work on next?"
        except requests.Timeout as error:
            app.logger.warning("Student assistant webhook request failed: %s", error)
            reply = "The assistant service timed out. Your message is saved; please try again shortly."
        except requests.HTTPError as error:
            status_code = error.response.status_code if error.response is not None else "unknown"
            app.logger.warning("Student assistant webhook returned HTTP %s", status_code)
            reply = f"The assistant service returned HTTP {status_code}. Your message is saved; check the webhook response configuration."
        except requests.ConnectionError as error:
            app.logger.warning("Student assistant webhook connection failed: %s", error)
            reply = "The assistant service could not be reached. Your message is saved; check network access and the webhook URL."
        except requests.RequestException as error:
            app.logger.warning("Student assistant webhook request failed: %s", error)
            reply = "The assistant service request failed. Your message is saved; please try again shortly."

    db.session.add(Message(role="assistant", content=reply, conversation=conversation))
    conversation.updated_at = utc_now()
    db.session.commit()
    return jsonify({"conversation": conversation.to_dict(include_messages=True)}), 201


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG") == "1")
