"""
Authentication and session management for the MPLADS module.
Uses JWT tokens to secure routes.
"""

import bcrypt
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pymongo.database import Database

from app.config import settings
from app.database import get_db

# Signing secret comes from Settings (app/config.py), which requires
# JWT_SECRET_KEY from the environment / .env — no hardcoded fallback.
# A hardcoded literal used to live here; treat it as compromised (it
# would have signed valid tokens) and make sure JWT_SECRET_KEY in .env
# is a freshly generated value, not that old string.
SECRET_KEY = settings.JWT_SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(token: str = Depends(oauth2_scheme), db: Database = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.users.find_one({"username": username})
    if user is None:
        raise credentials_exception

    # Checked here, not just at login — a token is valid for 24h
    # (ACCESS_TOKEN_EXPIRE_MINUTES), so only gating at login would let a
    # deactivated account (app/models.py's User.is_active, set via the
    # Admin role's /api/admin/users/{id}/active) keep using every
    # endpoint for up to a day on a token issued before deactivation.
    # .get() with a True default so accounts created before this field
    # existed aren't locked out by its absence.
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account has been deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Return dict with string id
    user["id"] = str(user.pop("_id"))
    return user


def require_role(*roles: str):
    """FastAPI dependency factory gating a route to specific roles.

    Usage: ``current_user: dict = Depends(require_role(ROLE_REVIEWER))``.
    Accepts multiple roles (e.g. a future Admin override) without
    changing the call sites that only need one. Returns 403, not 404 —
    the route exists, the caller just isn't allowed to use it; that
    distinction matters for a client debugging "why did this fail".
    """

    async def _check(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("role") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of these roles: {', '.join(roles)}.",
            )
        return current_user

    return _check
