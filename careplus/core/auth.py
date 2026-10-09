from typing import Optional, Dict, Any
from uuid import UUID
import httpx
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


def _resolve_via_supabase(token: str) -> Dict[str, Any]:
    """
    Validate a Supabase-issued access token authoritatively (GET /auth/v1/user).
    Works even when the local JWT secret differs from Supabase's, and resolves
    the app role/patient_id from the token + profiles/patient_app_user tables.
    """
    try:
        resp = httpx.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {token}",
            },
            timeout=10,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed: invalid token",
        )

    user = resp.json()
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: missing user ID")

    um = user.get("user_metadata") or {}
    am = user.get("app_metadata") or {}
    role = am.get("role") or um.get("role")
    patient_id = um.get("patient_id") or am.get("patient_id")
    email = user.get("email")
    full_name = um.get("full_name") or user.get("email")

    # Resolve role / patient_id from our tables when the token doesn't carry them.
    try:
        from careplus.db.client import get_supabase_client

        sb = get_supabase_client(use_service_role=True)
        if not role:
            prof = sb.table("profiles").select("role, full_name").eq("id", user_id).limit(1).execute()
            if prof.data:
                role = prof.data[0].get("role")
                full_name = full_name or prof.data[0].get("full_name")
        if not role:
            au = (
                sb.table("patient_app_user")
                .select("role, patient_id, name")
                .eq("auth_user_id", user_id)
                .limit(1)
                .execute()
            )
            if au.data:
                role = au.data[0].get("role")
                patient_id = patient_id or au.data[0].get("patient_id")
                full_name = full_name or au.data[0].get("name")
        if role == "patient" and not patient_id:
            p = sb.table("patient").select("id").eq("auth_user_id", user_id).limit(1).execute()
            if p.data:
                patient_id = p.data[0].get("id")
    except Exception:
        # Resolution is best-effort; the endpoint role check still applies.
        pass

    return {
        "user_id": user_id,
        "role": role,
        "patient_id": patient_id,
        "email": email,
        "full_name": full_name,
    }


def get_user_from_token(token: str) -> Dict[str, Any]:
    # 1) Fast path: locally verifiable tokens (e.g., our own HS256 tokens / tests).
    try:
        payload = verify_jwt(token)
        user_id = payload.get("sub")
        role = payload.get("role")
        patient_id = payload.get("patient_id")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: missing user ID")
        return {
            "user_id": user_id,
            "role": role,
            "patient_id": patient_id,
            "email": payload.get("email"),
            "full_name": payload.get("full_name") or payload.get("name"),
        }
    except HTTPException:
        # Local verification failed (likely a Supabase token with a different secret).
        # 2) Authoritative fallback via Supabase.
        return _resolve_via_supabase(token)
