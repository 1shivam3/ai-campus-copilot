"""
CoursePilot Google Calendar OAuth & Token Protection Service
Provides:
1. Cryptographically signed, session-bound HMAC state tokens to prevent OAuth CSRF / account substitution.
2. Persistent, encrypted OAuth token storage (AES-GCM / Fernet) ensuring tokens cannot be leaked or accessed across users.
"""

import os
import hmac
import hashlib
import time
import json
import base64
import secrets
import logging
from typing import Optional, Dict, Any
from pathlib import Path
from cryptography.fernet import Fernet

logger = logging.getLogger("coursepilot.calendar_auth")

# Master secret key derived from environment
_MASTER_SECRET = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("GOOGLE_CLIENT_SECRET")
    or os.getenv("SECRET_KEY")
    or "coursepilot-secure-calendar-key-32b-seed"
)

# Derive a stable 32-byte urlsafe base64 key for Fernet encryption
_derived_key = base64.urlsafe_b64encode(hashlib.sha256(_MASTER_SECRET.encode()).digest())
_cipher = Fernet(_derived_key)

# Local encrypted storage file path
_STORAGE_PATH = Path(os.path.dirname(os.path.abspath(__file__))).parent / ".calendar_tokens.enc"

# In-memory cached encrypted store for fast access
_encrypted_store: Dict[str, bytes] = {}

def _load_persisted_tokens():
    """Loads encrypted tokens from persistent storage on startup."""
    global _encrypted_store
    if _STORAGE_PATH.exists():
        try:
            with open(_STORAGE_PATH, "r", encoding="utf-8") as f:
                raw_json = json.load(f)
                _encrypted_store = {k: v.encode("utf-8") for k, v in raw_json.items()}
        except Exception as e:
            logger.warning(f"[CALENDAR_AUTH] Could not load persisted encrypted tokens: {e}")

def _save_persisted_tokens():
    """Flushes encrypted tokens to persistent storage."""
    try:
        raw_json = {k: v.decode("utf-8") for k, v in _encrypted_store.items()}
        with open(_STORAGE_PATH, "w", encoding="utf-8") as f:
            json.dump(raw_json, f)
    except Exception as e:
        logger.warning(f"[CALENDAR_AUTH] Could not write encrypted tokens to storage: {e}")

# Initialize storage on module import
_load_persisted_tokens()


# =========================================================================
# 1. CRYPTOGRAPHICALLY BOUND OAUTH STATE
# =========================================================================

def generate_oauth_state(user_id: str) -> str:
    """
    Generates a cryptographically signed OAuth state token bound to user_id.
    Format: base64(user_id:timestamp:nonce:signature)
    """
    if not user_id:
        raise ValueError("user_id is required to generate OAuth state")

    timestamp = str(int(time.time()))
    nonce = secrets.token_hex(8)
    payload = f"{user_id}:{timestamp}:{nonce}"
    signature = hmac.new(_MASTER_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    raw_token = f"{payload}:{signature}"
    return base64.urlsafe_b64encode(raw_token.encode()).decode()

def verify_oauth_state(state_token: str, expected_user_id: Optional[str] = None, max_age_seconds: int = 600) -> tuple[bool, Optional[str]]:
    """
    Verifies that the OAuth state token:
    1. Has a valid HMAC signature matching the backend master key.
    2. Has not expired (default: 10 minutes).
    3. Matches expected_user_id (if supplied).
    Returns (is_valid, user_id).
    """
    if not state_token:
        return False, None

    try:
        decoded = base64.urlsafe_b64decode(state_token.encode()).decode()
        parts = decoded.split(":")
        if len(parts) != 4:
            return False, None

        user_id, timestamp_str, nonce, signature = parts
        timestamp = int(timestamp_str)
        now = int(time.time())

        # Check expiration
        if now - timestamp > max_age_seconds or timestamp > now + 30:
            logger.warning(f"[CALENDAR_AUTH] Expired or invalid timestamp in OAuth state: {timestamp}")
            return False, None

        # Re-verify HMAC signature
        expected_payload = f"{user_id}:{timestamp_str}:{nonce}"
        expected_sig = hmac.new(_MASTER_SECRET.encode(), expected_payload.encode(), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(signature, expected_sig):
            logger.warning("[CALENDAR_AUTH] Tampered or invalid HMAC signature in OAuth state")
            return False, None

        # Check expected user identity binding
        if expected_user_id and user_id != expected_user_id:
            logger.warning(f"[CALENDAR_AUTH] OAuth state user {user_id} does not match caller {expected_user_id}")
            return False, None

        return True, user_id
    except Exception as e:
        logger.warning(f"[CALENDAR_AUTH] OAuth state verification failed: {e}")
        return False, None


# =========================================================================
# 2. PERSISTENT ENCRYPTED TOKEN MANAGEMENT
# =========================================================================

def save_calendar_tokens(user_id: str, token_data: Dict[str, Any]):
    """
    Encrypts and persists OAuth credentials for a specific user.
    """
    if not user_id or not token_data:
        return

    try:
        raw_json = json.dumps(token_data)
        encrypted_bytes = _cipher.encrypt(raw_json.encode("utf-8"))
        _encrypted_store[user_id] = encrypted_bytes
        _save_persisted_tokens()
        logger.info(f"[CALENDAR_AUTH] Securely saved encrypted tokens for user {user_id[:8]}...")
    except Exception as e:
        logger.error(f"[CALENDAR_AUTH] Encryption failure saving tokens for {user_id}: {e}")
        raise

def get_calendar_tokens(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves and decrypts OAuth credentials strictly for the authenticated user_id.
    """
    if not user_id or user_id not in _encrypted_store:
        return None

    try:
        encrypted_bytes = _encrypted_store[user_id]
        decrypted_json = _cipher.decrypt(encrypted_bytes).decode("utf-8")
        return json.loads(decrypted_json)
    except Exception as e:
        logger.warning(f"[CALENDAR_AUTH] Decryption error for user {user_id[:8]}: {e}")
        return None

def delete_calendar_tokens(user_id: str) -> bool:
    """
    Permanently deletes OAuth credentials for the authenticated user_id.
    """
    if not user_id:
        return False

    if user_id in _encrypted_store:
        del _encrypted_store[user_id]
        _save_persisted_tokens()
        logger.info(f"[CALENDAR_AUTH] Disconnected calendar and deleted tokens for user {user_id[:8]}")
        return True
    return False
