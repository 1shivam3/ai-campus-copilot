"""
Database Client Service Module for CoursePilot Backend.
Provides a robust, centralized, thread-safe server-side Supabase client
accessible by synchronous/asynchronous FastAPI request handlers, background tasks,
RAG pipelines, and study pack generators.
"""

import os
import logging
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

logger = logging.getLogger("coursepilot.database")

# Ensure environment variables are loaded if imported standalone
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()
load_dotenv(os.path.join(backend_dir, ".env"))

_supabase_client: Optional[Client] = None


def init_database_client() -> Client:
    """
    Initializes and validates the server-side Supabase client.
    Reads SUPABASE_URL / VITE_SUPABASE_URL and service-role / anon keys.
    Raises RuntimeError if required environment variables are missing.
    """
    global _supabase_client

    url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("VITE_SUPABASE_ANON_KEY")
    )

    if not url or not key:
        missing = []
        if not url:
            missing.append("SUPABASE_URL / VITE_SUPABASE_URL")
        if not key:
            missing.append("SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY")
        err_msg = f"Database configuration missing required environment variables: {', '.join(missing)}"
        logger.error(f"[DATABASE] {err_msg}")
        raise RuntimeError(err_msg)

    try:
        _supabase_client = create_client(url, key)
        logger.info("[DATABASE] Supabase server-side client initialized successfully.")
        return _supabase_client
    except Exception as exc:
        logger.error(f"[DATABASE] Failed to initialize Supabase client: {exc}")
        raise RuntimeError(f"Could not connect to database backend: {exc}")


def get_database_client() -> Client:
    """
    Returns the singleton Supabase client. If not initialized, attempts initialization.
    Safe for use inside request handlers, background tasks, and worker threads.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    return init_database_client()
