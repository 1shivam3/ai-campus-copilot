"""
Intelligent document chunking service for CoursePilot RAG pipeline.
Splits extracted document text into semantic chunks (~600-900 tokens) with overlap (~100-150 tokens).
"""

import re


def estimate_token_count(text: str) -> int:
    """Rough estimation of token count (~4 characters per token in English/code)."""
    return max(1, len(text) // 4)


def chunk_document_text(
    text: str,
    target_chunk_size: int = 2400,  # ~600-800 tokens
    chunk_overlap: int = 400,       # ~100 tokens
    min_chunk_size: int = 300,
) -> list[dict]:
    """
    Chunks document text preserving paragraph and heading boundaries.
    Returns list of dicts with:
    - chunk_index: int
    - content: str
    - page_number: int | None
    - token_count: int
    """
    if not text or not text.strip():
        return []

    # Clean text: normalize carriage returns
    clean_text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Detect page markers if present (e.g., \x0c or "--- Page X ---")
    page_splits = re.split(r"(?:\x0c|\n--- Page (\d+) ---\n)", clean_text)

    # Split into structural blocks (double newlines or markdown headings)
    paragraphs = re.split(r"\n\s*\n", clean_text)
    paragraphs = [p.strip() for p in paragraphs if p.strip()]

    if not paragraphs:
        paragraphs = [clean_text.strip()]

    chunks = []
    current_chunk_parts = []
    current_length = 0
    current_page = 1

    for para in paragraphs:
        # Check for page number cues in text
        page_match = re.search(r"(?:Page|Pg\.?)\s*(\d+)", para, re.IGNORECASE)
        if page_match:
            try:
                current_page = int(page_match.group(1))
            except Exception:
                pass

        para_len = len(para)

        # If adding this paragraph exceeds target size and current chunk is non-empty
        if current_length + para_len > target_chunk_size and current_chunk_parts:
            chunk_content = "\n\n".join(current_chunk_parts).strip()
            if len(chunk_content) >= min_chunk_size:
                chunks.append({
                    "chunk_index": len(chunks),
                    "content": chunk_content,
                    "page_number": current_page,
                    "token_count": estimate_token_count(chunk_content),
                })

            # Retain overlap from the end of current chunk
            overlap_text = chunk_content[-chunk_overlap:] if len(chunk_content) > chunk_overlap else ""
            if overlap_text:
                current_chunk_parts = [overlap_text, para]
                current_length = len(overlap_text) + para_len
            else:
                current_chunk_parts = [para]
                current_length = para_len
        else:
            current_chunk_parts.append(para)
            current_length += para_len

    # Add remaining text
    if current_chunk_parts:
        final_content = "\n\n".join(current_chunk_parts).strip()
        if final_content and (not chunks or len(final_content) >= min_chunk_size or len(chunks) == 0):
            chunks.append({
                "chunk_index": len(chunks),
                "content": final_content,
                "page_number": current_page,
                "token_count": estimate_token_count(final_content),
            })

    # Fallback for very small documents
    if not chunks and clean_text.strip():
        chunks.append({
            "chunk_index": 0,
            "content": clean_text.strip()[:target_chunk_size],
            "page_number": 1,
            "token_count": estimate_token_count(clean_text),
        })

    return chunks
