"""
Text chunking utilities for RAG.

Handles splitting transcripts into chunks with speaker/section metadata.
"""

import re
from dataclasses import dataclass

from src.core.config import settings


@dataclass
class Chunk:
    """A chunk of text with metadata."""

    content: str
    index: int
    speaker: str | None = None
    section: str | None = None


def chunk_text(
    text: str,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[Chunk]:
    """
    Split text into overlapping chunks.

    Args:
        text: The text to chunk
        chunk_size: Max characters per chunk (default from settings)
        chunk_overlap: Overlap between chunks (default from settings)

    Returns:
        List of Chunk objects
    """
    chunk_size = chunk_size or settings.chunk_size
    chunk_overlap = chunk_overlap or settings.chunk_overlap

    if len(text) <= chunk_size:
        return [Chunk(content=text.strip(), index=0)]

    chunks = []
    start = 0
    index = 0

    while start < len(text):
        end = start + chunk_size

        # Try to break at sentence boundary
        if end < len(text):
            # Look for sentence end within last 20% of chunk
            search_start = start + int(chunk_size * 0.8)
            sentence_end = text.rfind(". ", search_start, end)
            if sentence_end > search_start:
                end = sentence_end + 1

        chunk_text = text[start:end].strip()
        if chunk_text:
            chunks.append(Chunk(content=chunk_text, index=index))
            index += 1

        start = end - chunk_overlap

    return chunks


_OUTLOOK_HEADERS = re.compile(
    r"^\s*(?:business\s+)?(?:outlook|guidance|financial\s+outlook|forward.looking"
    r"|future\s+outlook|fiscal\s+\w+\s+\w*\s*outlook|q\d\s+\w*\s*outlook"
    r"|first|second|third|fourth)\b",
    re.IGNORECASE,
)


def chunk_press_release(text: str) -> list[Chunk]:
    """
    Chunk an earnings press release with section awareness.

    Detects 'Outlook'/'Guidance' headers to tag chunks as section='outlook'.
    Everything before the outlook section is tagged 'prepared_remarks'.
    """
    chunks: list[Chunk] = []
    index = 0
    current_section = "prepared_remarks"
    current_text: list[str] = []

    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue

        # Detect outlook section header (short line matching outlook keywords)
        if len(stripped) < 120 and _OUTLOOK_HEADERS.match(stripped):
            if current_text:
                content = " ".join(current_text)
                for chunk in chunk_text(content):
                    chunk.section = current_section
                    chunk.index = index
                    chunks.append(chunk)
                    index += 1
                current_text = []
            current_section = "outlook"
            continue

        current_text.append(stripped)

    if current_text:
        content = " ".join(current_text)
        for chunk in chunk_text(content):
            chunk.section = current_section
            chunk.index = index
            chunks.append(chunk)
            index += 1

    # If no outlook section was detected, tag the last 25% of chunks as outlook
    if current_section == "prepared_remarks" and chunks:
        cutoff = max(1, len(chunks) - len(chunks) // 4)
        for chunk in chunks[cutoff:]:
            chunk.section = "outlook"

    return chunks


def chunk_transcript(text: str) -> list[Chunk]:
    """
    Chunk an earnings transcript with speaker/section awareness.

    Attempts to parse common transcript formats and extract:
    - Speaker names (CEO, CFO, Analyst names)
    - Sections (prepared_remarks, q_and_a)
    """
    chunks = []
    index = 0

    # Common patterns for section headers
    qa_patterns = [
        r"question.?and.?answer",
        r"q\s*&\s*a\s+session",
        r"operator:.*questions",
    ]
    qa_regex = re.compile("|".join(qa_patterns), re.IGNORECASE)

    # Split into sections
    current_section = "prepared_remarks"
    current_speaker = None

    # Common speaker pattern: "Name - Title:" or "Name:"
    speaker_pattern = re.compile(
        r"^([A-Z][a-zA-Z\s\.\-]+?)(?:\s*[-–—]\s*[A-Za-z\s,]+)?:\s*",
        re.MULTILINE,
    )

    lines = text.split("\n")
    current_text = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Check for Q&A section start
        if qa_regex.search(line):
            # Flush current chunk
            if current_text:
                content = " ".join(current_text)
                for chunk in chunk_text(content):
                    chunk.speaker = current_speaker
                    chunk.section = current_section
                    chunk.index = index
                    chunks.append(chunk)
                    index += 1
                current_text = []

            current_section = "q_and_a"
            continue

        # Check for speaker change
        speaker_match = speaker_pattern.match(line)
        if speaker_match:
            # Flush current chunk
            if current_text:
                content = " ".join(current_text)
                for chunk in chunk_text(content):
                    chunk.speaker = current_speaker
                    chunk.section = current_section
                    chunk.index = index
                    chunks.append(chunk)
                    index += 1
                current_text = []

            current_speaker = speaker_match.group(1).strip()
            # Get text after speaker name
            remaining = line[speaker_match.end():].strip()
            if remaining:
                current_text.append(remaining)
        else:
            current_text.append(line)

    # Flush final chunk
    if current_text:
        content = " ".join(current_text)
        for chunk in chunk_text(content):
            chunk.speaker = current_speaker
            chunk.section = current_section
            chunk.index = index
            chunks.append(chunk)
            index += 1

    return chunks
