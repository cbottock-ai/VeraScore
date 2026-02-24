import json
import logging
from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.orm import Session

from src.chat.tools import execute_tool, get_anthropic_tools, get_openai_tools
from src.core.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are VeraScore, a financial research assistant. You help users analyze stocks using "
    "real data, explain VeraScore ratings, and manage investment portfolios. Always use the "
    "provided tools to look up real data — never fabricate numbers or scores. Be concise and "
    "data-driven."
)


class LLMProvider(ABC):
    @abstractmethod
    async def stream_response(
        self,
        messages: list[dict[str, Any]],
        db: Session,
    ) -> AsyncGenerator[str, None]:
        """Stream text chunks from the LLM, handling tool calls internally."""
        ...


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "claude-sonnet-4-5-20250929"):
        import anthropic

        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model = model
        self.tools = get_anthropic_tools()

    async def stream_response(
        self,
        messages: list[dict[str, Any]],
        db: Session,
    ) -> AsyncGenerator[str, None]:
        # Convert messages to Anthropic format
        anthropic_messages = []
        for msg in messages:
            if msg["role"] in ("user", "assistant"):
                anthropic_messages.append({"role": msg["role"], "content": msg["content"]})

        max_iterations = 10
        for _ in range(max_iterations):
            # Stream the response
            collected_content: list[dict] = []
            current_text = ""
            current_tool_use = None

            async with self.client.messages.stream(
                model=self.model,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                messages=anthropic_messages,
                tools=self.tools,
            ) as stream:
                async for event in stream:
                    if event.type == "content_block_start":
                        if event.content_block.type == "text":
                            current_text = ""
                        elif event.content_block.type == "tool_use":
                            current_tool_use = {
                                "id": event.content_block.id,
                                "name": event.content_block.name,
                                "input_json": "",
                            }
                    elif event.type == "content_block_delta":
                        if event.delta.type == "text_delta":
                            current_text += event.delta.text
                            yield event.delta.text
                        elif event.delta.type == "input_json_delta":
                            if current_tool_use:
                                current_tool_use["input_json"] += event.delta.partial_json
                    elif event.type == "content_block_stop":
                        if current_text:
                            collected_content.append({"type": "text", "text": current_text})
                            current_text = ""
                        if current_tool_use:
                            collected_content.append(
                                {
                                    "type": "tool_use",
                                    "id": current_tool_use["id"],
                                    "name": current_tool_use["name"],
                                    "input": json.loads(
                                        current_tool_use["input_json"]
                                        if current_tool_use["input_json"]
                                        else "{}"
                                    ),
                                }
                            )
                            current_tool_use = None

                final_message = stream.get_final_message()

            # Check if we need to handle tool calls
            tool_uses = [c for c in collected_content if c["type"] == "tool_use"]
            if not tool_uses:
                return

            # Execute tool calls and build tool results
            anthropic_messages.append({"role": "assistant", "content": collected_content})
            tool_results = []
            for tool_use in tool_uses:
                logger.info(f"Executing tool: {tool_use['name']}({tool_use['input']})")
                result = await execute_tool(tool_use["name"], tool_use["input"], db)
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_use["id"],
                        "content": result,
                    }
                )
            anthropic_messages.append({"role": "user", "content": tool_results})


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gpt-4o"):
        import openai

        self.client = openai.AsyncOpenAI(api_key=api_key)
        self.model = model
        self.tools = get_openai_tools()

    async def stream_response(
        self,
        messages: list[dict[str, Any]],
        db: Session,
    ) -> AsyncGenerator[str, None]:
        # Build OpenAI messages
        openai_messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in messages:
            if msg["role"] in ("user", "assistant"):
                openai_messages.append({"role": msg["role"], "content": msg["content"]})

        max_iterations = 10
        for _ in range(max_iterations):
            collected_text = ""
            tool_calls_data: dict[int, dict] = {}

            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=openai_messages,
                tools=self.tools,
                stream=True,
            )

            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if not delta:
                    continue

                if delta.content:
                    collected_text += delta.content
                    yield delta.content

                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls_data:
                            tool_calls_data[idx] = {
                                "id": tc.id or "",
                                "name": "",
                                "arguments": "",
                            }
                        if tc.id:
                            tool_calls_data[idx]["id"] = tc.id
                        if tc.function:
                            if tc.function.name:
                                tool_calls_data[idx]["name"] = tc.function.name
                            if tc.function.arguments:
                                tool_calls_data[idx]["arguments"] += tc.function.arguments

            # No tool calls — we're done
            if not tool_calls_data:
                return

            # Build assistant message with tool calls
            assistant_tool_calls = []
            for idx in sorted(tool_calls_data.keys()):
                tc = tool_calls_data[idx]
                assistant_tool_calls.append(
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {"name": tc["name"], "arguments": tc["arguments"]},
                    }
                )

            openai_messages.append(
                {
                    "role": "assistant",
                    "content": collected_text or None,
                    "tool_calls": assistant_tool_calls,
                }
            )

            # Execute each tool and add results
            for tc_info in assistant_tool_calls:
                name = tc_info["function"]["name"]
                args = json.loads(tc_info["function"]["arguments"])
                logger.info(f"Executing tool: {name}({args})")
                result = await execute_tool(name, args, db)
                openai_messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc_info["id"],
                        "content": result,
                    }
                )


# Runtime state for provider toggle
_runtime_provider: str | None = None
_runtime_model: str | None = None


def set_runtime_provider(provider: str, model: str | None = None) -> None:
    global _runtime_provider, _runtime_model
    _runtime_provider = provider
    _runtime_model = model


def get_provider_info() -> dict[str, Any]:
    provider = _runtime_provider or settings.llm_provider
    available = []
    if settings.anthropic_api_key:
        available.append("anthropic")
    if settings.openai_api_key:
        available.append("openai")

    if provider == "openai":
        model = _runtime_model or settings.llm_model or "gpt-4o"
    else:
        model = _runtime_model or settings.llm_model or "claude-sonnet-4-5-20250929"

    return {"provider": provider, "model": model, "available_providers": available}


def get_provider() -> LLMProvider:
    info = get_provider_info()
    provider = info["provider"]
    model = info["model"]

    if provider == "openai":
        if not settings.openai_api_key:
            raise ValueError("OpenAI API key not configured")
        return OpenAIProvider(api_key=settings.openai_api_key, model=model)
    else:
        if not settings.anthropic_api_key:
            raise ValueError("Anthropic API key not configured")
        return AnthropicProvider(api_key=settings.anthropic_api_key, model=model)
