import re
from dataclasses import dataclass

from src.core.config import settings


@dataclass
class TextChunk:
    """A chunk of text with metadata."""

    content: str
    index: int
    speaker: str | None = None
    section: str | None = None


def chunk_text(
    text: str,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[TextChunk]:
    """Split text into overlapping chunks."""
    chunk_size = chunk_size or settings.chunk_size
    chunk_overlap = chunk_overlap or settings.chunk_overlap

    # Clean the text
    text = text.strip()
    if not text:
        return []

    chunks = []
    start = 0
    index = 0

    while start < len(text):
        end = start + chunk_size

        # Try to find a good break point (sentence end, paragraph)
        if end < len(text):
            # Look for sentence boundaries
            for sep in [". ", ".\n", "\n\n", "\n", " "]:
                break_point = text.rfind(sep, start, end)
                if break_point > start:
                    end = break_point + len(sep)
                    break

        chunk_text_content = text[start:end].strip()
        if chunk_text_content:
            chunks.append(TextChunk(content=chunk_text_content, index=index))
            index += 1

        # Move start with overlap
        start = end - chunk_overlap if end < len(text) else end

    return chunks


def parse_transcript_sections(transcript_text: str) -> list[TextChunk]:
    """Parse transcript into chunks with speaker and section metadata."""
    chunks = []
    current_section = "prepared_remarks"
    chunk_index = 0

    # Common patterns for Q&A section starts
    qa_patterns = [
        r"question[s]?\s*(?:and|&)\s*answer",
        r"Q\s*&\s*A",
        r"Q&A Session",
        r"Operator.*question",
    ]
    qa_regex = re.compile("|".join(qa_patterns), re.IGNORECASE)

    # Speaker patterns - match "Name:" or "Name --" at start of line
    speaker_pattern = re.compile(
        r"^([A-Z][A-Za-z\s\.\,]+(?:CEO|CFO|COO|CTO|President|Analyst|VP|Director)?[^:]*?)(?::|--)",
        re.MULTILINE,
    )

    # Split by paragraphs first
    paragraphs = re.split(r"\n\s*\n+", transcript_text)

    current_speaker = None
    current_content = []

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # Check if entering Q&A section
        if qa_regex.search(para):
            current_section = "q_and_a"

        # Check for speaker change
        speaker_match = speaker_pattern.match(para)
        if speaker_match:
            # Save previous content
            if current_content:
                text_content = " ".join(current_content)
                for chunk in chunk_text(text_content):
                    chunk.speaker = current_speaker
                    chunk.section = current_section
                    chunk.index = chunk_index
                    chunks.append(chunk)
                    chunk_index += 1
                current_content = []

            current_speaker = _normalize_speaker(speaker_match.group(1).strip())
            # Get content after speaker name
            remaining = para[speaker_match.end() :].strip()
            if remaining:
                current_content.append(remaining)
        else:
            current_content.append(para)

    # Don't forget the last chunk
    if current_content:
        text_content = " ".join(current_content)
        for chunk in chunk_text(text_content):
            chunk.speaker = current_speaker
            chunk.section = current_section
            chunk.index = chunk_index
            chunks.append(chunk)
            chunk_index += 1

    return chunks


def _normalize_speaker(speaker: str) -> str:
    """Normalize speaker name/role."""
    speaker = speaker.strip()

    # Common role keywords
    role_keywords = {
        "CEO": "CEO",
        "Chief Executive": "CEO",
        "CFO": "CFO",
        "Chief Financial": "CFO",
        "COO": "COO",
        "CTO": "CTO",
        "President": "President",
        "Analyst": "Analyst",
        "Operator": "Operator",
    }

    for keyword, role in role_keywords.items():
        if keyword.lower() in speaker.lower():
            return role

    # Return cleaned name
    return speaker[:100] if len(speaker) > 100 else speaker
