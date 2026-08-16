"""
Centralized Server-Side Database Client Service for CoursePilot.
Provides a robust, thread-safe, self-healing singleton Supabase client
used consistently by all request handlers, background tasks, RAG services,
and AI document generators.
"""

import os
import logging
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

logger = logging.getLogger("coursepilot.database")

# Multi-path .env resolution (handles backend, project root, and frontend)
_current_dir = Path(__file__).resolve().parent
_backend_dir = _current_dir.parent
_project_root = _backend_dir.parent
_frontend_dir = _project_root / "frontend"

for env_path in [
    _backend_dir / ".env",
    _project_root / ".env",
    _frontend_dir / ".env",
]:
    if env_path.is_file():
        load_dotenv(dotenv_path=env_path, override=False)

_supabase_client: Optional[Client] = None


def resolve_supabase_credentials() -> tuple[Optional[str], Optional[str]]:
    """
    Extracts and sanitizes Supabase URL and service/anon key from environment.
    Strips accidental quotes, trailing slashes, and leading/trailing whitespace.
    """
    url_raw = (
        os.getenv("SUPABASE_URL")
        or os.getenv("VITE_SUPABASE_URL")
        or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        or os.getenv("PUBLIC_SUPABASE_URL")
        or os.getenv("SUPABASE_PROJECT_URL")
    )
    
    key_raw = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_SERVICE_ROLE")
        or os.getenv("SUPABASE_SECRET_KEY")
        or os.getenv("SUPABASE_KEY")
        or os.getenv("SUPABASE_API_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("VITE_SUPABASE_ANON_KEY")
        or os.getenv("VITE_SUPABASE_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    )

    url = url_raw.strip().strip("'\"").rstrip("/") if url_raw else None
    key = key_raw.strip().strip("'\"").strip() if key_raw else None

    return url, key


def init_database_client() -> Client:
    """
    Initializes and validates the server-side Supabase client singleton.
    Fails fast with informative server logs if configuration is missing.
    """
    global _supabase_client

    url, key = resolve_supabase_credentials()

    if not url or not key:
        missing = []
        if not url:
            missing.append("SUPABASE_URL / VITE_SUPABASE_URL")
        if not key:
            missing.append("SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY / SUPABASE_ANON_KEY")
        err_msg = f"Database configuration missing required environment variables: {', '.join(missing)}"
        logger.error(f"[DATABASE] {err_msg}")
        raise RuntimeError(err_msg)

    try:
        _supabase_client = create_client(url, key)
        logger.info(f"[DATABASE] Centralized Supabase client initialized for project {url[:25]}...")
        return _supabase_client
    except Exception as exc:
        logger.error(f"[DATABASE] Failed to initialize Supabase client: {exc}")
        raise RuntimeError(f"Could not connect to database backend: {exc}")


def get_database_client() -> Client:
    """
    Thread-safe accessor for the single server-side Supabase client.
    Works seamlessly across sync/async request handlers, worker threads, and background tasks.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    return init_database_client()
