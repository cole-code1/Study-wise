from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Conversation(db.Model):
    __tablename__ = "conversations"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False, default="New conversation")
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)
    updated_at = db.Column(db.DateTime, nullable=False, default=utc_now, index=True)
    messages = db.relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.id",
        lazy="selectin",
    )

    def to_dict(self, include_messages=False):
        latest_message = self.messages[-1] if self.messages else None
        data = {
            "id": self.id,
            "title": self.title,
            "createdAt": self.created_at.isoformat(timespec="seconds") + "Z",
            "updatedAt": self.updated_at.isoformat(timespec="seconds") + "Z",
            "preview": latest_message.content if latest_message else None,
            "messageCount": len(self.messages),
        }
        if include_messages:
            data["messages"] = [message.to_dict() for message in self.messages]
        return data


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(
        db.Integer,
        db.ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)
    conversation = db.relationship("Conversation", back_populates="messages")

    __table_args__ = (
        db.CheckConstraint("role IN ('user', 'assistant')", name="valid_message_role"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "role": self.role,
            "content": self.content,
            "createdAt": self.created_at.isoformat(timespec="seconds") + "Z",
        }
