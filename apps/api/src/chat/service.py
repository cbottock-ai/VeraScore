import json
import logging
from collections.abc import AsyncGenerator

from sqlalchemy.orm import Session

from src.chat.llm import get_provider
from src.chat.models import Conversation, Message
from src.chat.schemas import ConversationDetail, ConversationSummary, MessageResponse

logger = logging.getLogger(__name__)


def create_conversation(db: Session, title: str = "New Conversation") -> ConversationSummary:
    conv = Conversation(title=title)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return ConversationSummary(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
    )


def list_conversations(db: Session) -> list[ConversationSummary]:
    convs = db.query(Conversation).order_by(Conversation.updated_at.desc()).all()
    return [
        ConversationSummary(
            id=c.id,
            title=c.title,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        )
        for c in convs
    ]


def get_conversation(conversation_id: int, db: Session) -> ConversationDetail | None:
    conv = db.get(Conversation, conversation_id)
    if not conv:
        return None
    return ConversationDetail(
        id=conv.id,
        title=conv.title,
        messages=[
            MessageResponse(
                id=m.id,
                role=m.role,
                content=m.content,
                created_at=m.created_at.isoformat(),
            )
            for m in conv.messages
        ],
    )


def delete_conversation(conversation_id: int, db: Session) -> bool:
    conv = db.get(Conversation, conversation_id)
    if not conv:
        return False
    db.delete(conv)
    db.commit()
    return True


def _save_message(db: Session, conversation_id: int, role: str, content: str) -> Message:
    msg = Message(conversation_id=conversation_id, role=role, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def _get_message_history(db: Session, conversation_id: int) -> list[dict]:
    conv = db.get(Conversation, conversation_id)
    if not conv:
        return []
    return [{"role": m.role, "content": m.content} for m in conv.messages]


async def send_message(
    conversation_id: int,
    content: str,
    db: Session,
) -> AsyncGenerator[str, None]:
    """Send a user message and stream the assistant response."""
    # Verify conversation exists
    conv = db.get(Conversation, conversation_id)
    if not conv:
        yield "data: {\"error\": \"Conversation not found\"}\n\n"
        return

    # Save user message
    _save_message(db, conversation_id, "user", content)

    # Auto-title on first message
    if conv.title == "New Conversation" and len(conv.messages) == 1:
        conv.title = content[:50] + ("..." if len(content) > 50 else "")
        db.commit()

    # Load history
    history = _get_message_history(db, conversation_id)

    # Get LLM provider and stream
    provider = get_provider()
    full_response = ""

    try:
        async for chunk in provider.stream_response(history, db):
            full_response += chunk
            # SSE format — JSON-encode to preserve newlines
            yield f"data: {json.dumps(chunk)}\n\n"

        # Save assistant response
        if full_response:
            _save_message(db, conversation_id, "assistant", full_response)

        yield "data: [DONE]\n\n"

    except Exception as e:
        logger.exception("Error streaming LLM response")
        error_msg = f"Sorry, I encountered an error: {e}"
        _save_message(db, conversation_id, "assistant", error_msg)
        yield f"data: {error_msg}\n\n"
        yield "data: [DONE]\n\n"
