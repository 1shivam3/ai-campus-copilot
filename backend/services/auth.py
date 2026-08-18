"""
CoursePilot Authentication & JWT Validation Service
Validates Supabase Access Tokens / JWTs to establish authoritative caller identity.
Guarantees that user_id is never trusted from client request bodies or query params.
"""

import logging
import os
import jwt
from typing import Optional
from fastapi import Header, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from services.database import get_database_client

logger = logging.getLogger("coursepilot.auth")
security = HTTPBearer(auto_error=False)

class AuthenticatedUser(BaseModel):
    id: str
    email: Optional[str] = None
    role: Optional[str] = "authenticated"

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> AuthenticatedUser:
    """
    FastAPI dependency that extracts and verifies the Supabase access token (JWT).
    Returns AuthenticatedUser containing the verified user_id.
    Raises HTTP 401 Unauthorized if missing, malformed, expired, or invalid.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Missing Bearer authorization token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials.strip()
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Empty authorization token provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Test / Mock Mode Bypass for isolated test suites
    if os.getenv("TEST_MODE") == "1" or os.getenv("ENV") == "test":
        if token.startswith("test-token-user-"):
            user_id = token.replace("test-token-user-", "")
            return AuthenticatedUser(id=user_id, email=f"{user_id}@university.edu")
        elif token == "valid-test-token-user-a":
            return AuthenticatedUser(id="00000000-0000-0000-0000-000000000001", email="usera@university.edu")
        elif token == "valid-test-token-user-b":
            return AuthenticatedUser(id="00000000-0000-0000-0000-000000000002", email="userb@university.edu")

    # 2. Local JWT decode check (Fast path for standard Supabase JWTs)
    try:
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        user_id = unverified_payload.get("sub")
        email = unverified_payload.get("email")
        role = unverified_payload.get("role", "authenticated")

        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid token payload: missing subject identifier (sub).",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except Exception as e:
        logger.warning(f"[AUTH] JWT decoding error: {e}")
        raise HTTPException(
            status_code=401,
            detail="Malformed or unreadable authorization token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Cryptographic Verification via Supabase Auth API
    try:
        db_client = get_database_client()
        user_response = db_client.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired session token.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        verified_user = user_response.user
        return AuthenticatedUser(
            id=str(verified_user.id),
            email=verified_user.email,
            role=verified_user.role or role,
        )
    except HTTPException:
        raise
    except Exception as auth_err:
        err_msg = str(auth_err)
        logger.warning(f"[AUTH] Supabase token validation failure: {err_msg}")
        raise HTTPException(
            status_code=401,
            detail="Session authentication failed or token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> Optional[AuthenticatedUser]:
    """
    FastAPI dependency for endpoints with optional authentication.
    Returns AuthenticatedUser if valid token provided, else None.
    """
    if not credentials or not credentials.credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def generate_test_token(user_id: str, email: Optional[str] = None) -> str:
    """
    Generates a deterministic mock bearer token for automated testing suites.
    Recognized only when TEST_MODE=1.
    """
    return f"test-token-user-{user_id}"
