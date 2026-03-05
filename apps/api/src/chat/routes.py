from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.auth import User, get_optional_user
from src.chat.llm import get_provider_info, set_runtime_provider
from src.chat.schemas import (
    ConversationCreate,
    ConversationDetail,
    ConversationSummary,
    LLMProviderInfo,
    MessageCreate,
    ProviderUpdate,
)
from src.chat.service import (
    create_conversation,
    delete_conversation,
    get_conversation,
    list_conversations,
    send_message,
)
from src.chat.tracing import get_traces, get_usage_summary
from src.core.database import get_db

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_all(db: Session = Depends(get_db)):
    return list_conversations(db)


@router.post("/conversations", response_model=ConversationSummary, status_code=201)
async def create(data: ConversationCreate, db: Session = Depends(get_db)):
    return create_conversation(db, data.title)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def detail(conversation_id: int, db: Session = Depends(get_db)):
    conv = get_conversation(conversation_id, db)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete(conversation_id: int, db: Session = Depends(get_db)):
    if not delete_conversation(conversation_id, db):
        raise HTTPException(status_code=404, detail="Conversation not found")


@router.post("/conversations/{conversation_id}/messages")
async def post_message(
    conversation_id: int,
    data: MessageCreate,
    db: Session = Depends(get_db),
):
    return StreamingResponse(
        send_message(conversation_id, data.content, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/provider", response_model=LLMProviderInfo)
async def get_provider():
    return LLMProviderInfo(**get_provider_info())


@router.put("/provider", response_model=LLMProviderInfo)
async def update_provider(data: ProviderUpdate):
    set_runtime_provider(data.provider, data.model)
    return LLMProviderInfo(**get_provider_info())


# --- AI Tracing ---


@router.get("/traces")
async def list_traces(
    conversation_id: int | None = Query(None),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """
    Get AI trace history.

    Returns token usage, costs, latency, and tool calls for debugging/auditing.
    """
    user_id = user.id if user else None
    traces = get_traces(db, user_id=user_id, conversation_id=conversation_id, limit=limit)
    return [
        {
            "id": t.id,
            "conversation_id": t.conversation_id,
            "provider": t.provider,
            "model": t.model,
            "input_tokens": t.input_tokens,
            "output_tokens": t.output_tokens,
            "total_tokens": t.total_tokens,
            "estimated_cost_usd": t.estimated_cost,
            "latency_ms": t.latency_ms,
            "tool_calls": t.tool_names.split(",") if t.tool_names else [],
            "error": t.error,
            "created_at": t.created_at.isoformat(),
        }
        for t in traces
    ]


@router.get("/traces/summary")
async def trace_summary(
    days: int = Query(30, le=365),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """
    Get usage summary for cost monitoring.

    Returns total tokens, costs, and average latency over the specified period.
    """
    user_id = user.id if user else None
    return get_usage_summary(db, user_id=user_id, days=days)
