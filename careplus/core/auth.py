from typing import Optional, Dict, Any
from jose import JWTError, jwt
from fastapi import HTTPException, status
from careplus.core.config import settings


def verify_jwt(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm]
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_user_from_token(token: str) -> Dict[str, Any]:
    payload = verify_jwt(token)
    user_id = payload.get("sub")
    role = payload.get("role")
    patient_id = payload.get("patient_id")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user ID"
        )

    return {
        "user_id": user_id,
        "role": role,
        "patient_id": patient_id
    }
