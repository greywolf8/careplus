from functools import wraps
from typing import Callable, Optional, Any
from fastapi import HTTPException, status, Request
from uuid import UUID

from careplus.services.policy import policy_check
from careplus.core.logging import logger


def require_policy_check(
    purpose: str,
    payload_getter: Callable[[Any], str],
    patient_id_getter: Callable[[Any], UUID],
    operation: str,
    output_source_getter: Optional[Callable[[Any], str]] = None,
    rmp_id_getter: Optional[Callable[[Any], UUID]] = None,
    mci_reg_getter: Optional[Callable[[Any], str]] = None
):
    """
    Decorator to enforce policy checks before AI operations.
    
    Args:
        purpose: The purpose for consent check (e.g., "data_processing")
        payload_getter: Function to extract payload from request body
        patient_id_getter: Function to extract patient_id from request body
        operation: The operation name (e.g., "extract", "translate")
        output_source_getter: Optional function to extract output_source
        rmp_id_getter: Optional function to extract rmp_id
        mci_reg_getter: Optional function to extract mci_reg_number
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            # Get user info from request state (set by auth middleware)
            user = request.state.user
            actor_id = UUID(user.get("user_id"))
            actor_type = user.get("role", "system")
            
            # Get request body (it's already parsed by FastAPI)
            body = kwargs.get("body") or args[0] if args else None
            if body is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Request body required for policy check"
                )
            
            # Extract required fields
            try:
                payload = payload_getter(body)
                patient_id = patient_id_getter(body)
            except (KeyError, AttributeError, ValueError) as e:
                logger.error("policy_check_field_error", error=str(e))
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing required field for policy check: {str(e)}"
                )
            
            # Extract optional fields
            output_source = output_source_getter(body) if output_source_getter else None
            rmp_id = rmp_id_getter(body) if rmp_id_getter else None
            mci_reg = mci_reg_getter(body) if mci_reg_getter else None
            
            # Run policy check
            result = await policy_check(
                patient_id=patient_id,
                purpose=purpose,
                payload=payload,
                actor_id=actor_id,
                actor_type=actor_type,
                operation=operation,
                output_source=output_source,
                rmp_id=rmp_id,
                mci_reg_number=mci_reg
            )
            
            # Check if denied
            if not result["allowed"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error_code": "NOT_AUTHORIZED",
                        "message": result["reason"],
                        "cited_regulation": result.get("cited_regulation")
                    }
                )
            
            # Proceed with the original function
            return await func(request, *args, **kwargs)
        
        return wrapper
    return decorator
