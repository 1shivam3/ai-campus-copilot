"""
Embedding service for CoursePilot RAG pipeline.
Uses Google Gemini Embedding API with 768-dimensional output vectors.
"""

import logging
import os
import time
from dotenv import load_dotenv

logger = logging.getLogger("coursepilot.rag")
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 768

# Initialize client
client = None
if api_key:
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
    except Exception as err:
        logger.warning(f"Could not initialize GenAI embedding client: {err}")


def embed_text(text: str) -> list[float]:
    """
    Generates a 768-dimensional embedding vector for document passage text.
    """
    if not client or not text.strip():
        return []

    from google.genai import types

    # Clean and cap text
    clean_text = text.strip()[:8000]

    for attempt in range(3):
        try:
            res = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=clean_text,
                config=types.EmbedContentConfig(
                    output_dimensionality=EMBEDDING_DIM,
                    task_type="RETRIEVAL_DOCUMENT",
                ),
            )
            emb = res.embedding if hasattr(res, "embedding") else res.embeddings[0]
            values = emb.values if hasattr(emb, "values") else emb
            return list(values)
        except Exception as err:
            logger.warning(f"[EMBED] embed_text attempt {attempt + 1} failed: {err}")
            time.sleep(1.0 * (attempt + 1))

    return []


def embed_query(query: str) -> list[float]:
    """
    Generates a 768-dimensional embedding vector for student search questions.
    """
    if not client or not query.strip():
        return []

    from google.genai import types

    clean_query = query.strip()[:2000]

    for attempt in range(3):
        try:
            res = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=clean_query,
                config=types.EmbedContentConfig(
                    output_dimensionality=EMBEDDING_DIM,
                    task_type="RETRIEVAL_QUERY",
                ),
            )
            emb = res.embedding if hasattr(res, "embedding") else res.embeddings[0]
            values = emb.values if hasattr(emb, "values") else emb
            return list(values)
        except Exception as err:
            logger.warning(f"[EMBED] embed_query attempt {attempt + 1} failed: {err}")
            time.sleep(1.0 * (attempt + 1))

    return []


def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Generates embeddings for a batch of text chunks with rate-limit pacing.
    """
    results = []
    for i, t in enumerate(texts):
        emb = embed_text(t)
        results.append(emb)
        # Gentle pacing between embedding calls to prevent free-tier throttling
        if (i + 1) % 5 == 0:
            time.sleep(0.3)
    return results
