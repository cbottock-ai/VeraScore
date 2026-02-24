from pydantic import BaseModel


class ConversationSummary(BaseModel):
    id: int
    title: str
    created_at: str
    updated_at: str


class ConversationCreate(BaseModel):
    title: str = "New Conversation"


class MessageCreate(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: str


class ConversationDetail(BaseModel):
    id: int
    title: str
    messages: list[MessageResponse]


class LLMProviderInfo(BaseModel):
    provider: str
    model: str
    available_providers: list[str]


class ProviderUpdate(BaseModel):
    provider: str
    model: str | None = None
