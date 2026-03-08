"""
Clerk JWT verification middleware for FastAPI.

Clerk JWTs are verified using the JWKS endpoint from Clerk's API.
The middleware extracts user info and creates/updates users in our DB.
"""

import httpx
import jwt
from fastapi import Depends, HTTPException, Request, status
from jwt import PyJWKClient
from sqlalchemy.orm import Session

from src.auth.models import User
from src.core.config import settings
from src.core.database import get_db

# Cache the JWKS client
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    """Get or create the JWKS client for Clerk token verification."""
    global _jwks_client
    if _jwks_client is None:
        # Extract the Clerk instance ID from the secret key
        # Clerk secret keys are in format: sk_test_XXXX or sk_live_XXXX
        # The JWKS URL uses the frontend API domain
        if not settings.clerk_publishable_key:
            raise ValueError("CLERK_PUBLISHABLE_KEY not configured")

        # Publishable key format: pk_test_XXXX or pk_live_XXXX
        # The base64 part after pk_test_ decodes to the frontend API URL
        # For simplicity, we use Clerk's standard JWKS endpoint format
        # which is: https://<clerk-frontend-api>/.well-known/jwks.json

        # Extract frontend API from publishable key
        import base64
        key_parts = settings.clerk_publishable_key.split("_")
        if len(key_parts) >= 3:
            encoded_part = key_parts[2]
            # Add padding if needed
            padding = 4 - len(encoded_part) % 4
            if padding != 4:
                encoded_part += "=" * padding
            try:
                frontend_api = base64.b64decode(encoded_part).decode("utf-8")
                # Strip trailing $ which is a Clerk encoding marker
                frontend_api = frontend_api.rstrip("$")
                jwks_url = f"https://{frontend_api}/.well-known/jwks.json"
            except Exception:
                # Fallback to standard Clerk JWKS URL pattern
                jwks_url = f"https://clerk.{settings.clerk_publishable_key.split('_')[1]}.lcl.dev/.well-known/jwks.json"
        else:
            raise ValueError("Invalid CLERK_PUBLISHABLE_KEY format")

        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


def verify_clerk_token(token: str) -> dict:
    """
    Verify a Clerk JWT and return the decoded payload.

    Raises HTTPException if verification fails.
    """
    try:
        jwks_client = _get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},  # Clerk doesn't always set audience
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
        )


def get_token_from_request(request: Request) -> str | None:
    """Extract the bearer token from the Authorization header."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency that extracts and verifies the Clerk token,
    then returns the corresponding User from our database.

    Creates the user if they don't exist yet (first login).
    """
    token = get_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No authentication token provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_clerk_token(token)

    # Extract user info from Clerk token
    clerk_id = payload.get("sub")
    if not clerk_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing subject",
        )

    # Look up or create user
    user = db.query(User).filter(User.clerk_id == clerk_id).first()

    if not user:
        # Create new user from Clerk data
        # Note: Clerk tokens may not include all user data
        # Full user data can be fetched via Clerk API if needed
        email = payload.get("email") or payload.get("primary_email_address") or f"{clerk_id}@clerk.user"

        user = User(
            clerk_id=clerk_id,
            email=email,
            first_name=payload.get("first_name"),
            last_name=payload.get("last_name"),
            image_url=payload.get("image_url"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return user


async def get_optional_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User | None:
    """
    Same as get_current_user but returns None instead of raising
    an exception if no token is provided. Useful for endpoints that
    work with or without authentication.
    """
    token = get_token_from_request(request)
    if not token:
        return None

    try:
        payload = verify_clerk_token(token)
        clerk_id = payload.get("sub")
        if not clerk_id:
            return None

        user = db.query(User).filter(User.clerk_id == clerk_id).first()
        if not user:
            email = payload.get("email") or payload.get("primary_email_address") or f"{clerk_id}@clerk.user"
            user = User(
                clerk_id=clerk_id,
                email=email,
                first_name=payload.get("first_name"),
                last_name=payload.get("last_name"),
                image_url=payload.get("image_url"),
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        return user
    except HTTPException:
        return None
