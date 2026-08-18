"""
CoursePilot Sliding-Window Rate Limiter
Lightweight in-memory rate limiting to protect expensive Generative AI,
RAG indexing, and chat endpoints from abuse and rapid repeated firing.
"""

import time
import logging
from collections import defaultdict
from fastapi import HTTPException

logger = logging.getLogger("coursepilot.ratelimiter")

# Stores list of request timestamps: { "user_id:endpoint_group": [timestamp1, timestamp2, ...] }
_request_history: dict[str, list[float]] = defaultdict(list)

def check_rate_limit(
    user_id: str,
    action_key: str,
    max_requests: int = 20,
    window_seconds: int = 60,
):
    """
    Enforces a sliding-window rate limit.
    Raises HTTP 429 if the request count exceeds max_requests within window_seconds.
    """
    if not user_id:
        return

    now = time.time()
    key = f"{user_id}:{action_key}"
    timestamps = _request_history[key]

    # Remove timestamps older than the sliding window
    cutoff = now - window_seconds
    _request_history[key] = [t for t in timestamps if t > cutoff]

    if len(_request_history[key]) >= max_requests:
        retry_after = int(window_seconds - (now - _request_history[key][0])) + 1
        logger.warning(f"[RATE_LIMIT] User {user_id[:8]} exceeded limit for {action_key} ({len(_request_history[key])}/{max_requests})")
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded for {action_key}. Please wait {max(1, retry_after)} seconds before trying again.",
            headers={"Retry-After": str(max(1, retry_after))},
        )

    _request_history[key].append(now)

def clear_rate_limits():
    """Utility for automated test resets."""
    _request_history.clear()
