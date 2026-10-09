from typing import Dict, Any, List, Optional
from careplus.db.client import get_supabase_client
from careplus.core.logging import logger


async def find_matching_providers(
    item_type: str,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: int = 10
) -> Dict[str, Any]:
    """
    Find matching providers for a given item type using RPCs against Care Provider Finder dataset.
    
    Uses nearby_providers() and item_provider_matches() RPCs.
    Returns ranked list with disclaimer.
    
    Never claims 'best', 'recommended', 'guaranteed'.
    
    Args:
        item_type: Type of item (e.g., 'cardiology', 'orthopedics', 'test', 'medication')
        latitude: Optional latitude for geographic search
        longitude: Optional longitude for geographic search
        radius_km: Search radius in kilometers (default 10)
    
    Returns:
        Dict with:
        - providers: List of provider dicts with id, name, distance_km, match_score, specialty
        - disclaimer: Standard disclaimer text
        - total_count: Total number of providers found
    """
    supabase = get_supabase_client(use_service_role=True)
    
    try:
        # Step 1: Call item_provider_matches RPC to get providers matching the item type
        match_result = supabase.rpc("item_provider_matches", {"p_item_type": item_type}).execute()
        
        providers = []
        if match_result.data:
            for row in match_result.data:
                providers.append({
                    "provider_id": row.get("provider_id"),
                    "provider_name": row.get("provider_name"),
                    "match_score": row.get("match_score", 0.5),
                    "specialty": None  # Would be populated from RMP table in production
                })
        
        # Step 2: If geographic coordinates provided, call nearby_providers RPC and merge
        if latitude is not None and longitude is not None:
            nearby_result = supabase.rpc(
                "nearby_providers",
                {
                    "p_latitude": latitude,
                    "p_longitude": longitude,
                    "p_radius_km": radius_km
                }
            ).execute()
            
            if nearby_result.data:
                # Merge results: add distance information
                nearby_ids = {row["provider_id"] for row in nearby_result.data}
                
                for provider in providers:
                    if provider["provider_id"] in nearby_ids:
                        # Find the corresponding nearby provider to get distance
                        for nearby_row in nearby_result.data:
                            if nearby_row["provider_id"] == provider["provider_id"]:
                                provider["distance_km"] = nearby_row.get("distance_km", 0.0)
                                break
                
                # Add providers that are nearby but not in item matches (lower priority)
                for nearby_row in nearby_result.data:
                    if nearby_row["provider_id"] not in {p["provider_id"] for p in providers}:
                        providers.append({
                            "provider_id": nearby_row["provider_id"],
                            "provider_name": nearby_row["name"],
                            "match_score": 0.3,  # Lower score for geographic-only match
                            "distance_km": nearby_row.get("distance_km", 0.0),
                            "specialty": None
                        })
        
        # Step 3: Sort by match_score (descending), then by distance (ascending if available)
        providers.sort(key=lambda p: (-p["match_score"], p.get("distance_km", float('inf'))))
        
        # Step 4: Add disclaimer
        disclaimer = "Suggestion only. Please confirm availability with the provider."
        
        logger.info(
            "providers_matched",
            item_type=item_type,
            count=len(providers),
            has_geo=latitude is not None
        )
        
        return {
            "providers": providers,
            "disclaimer": disclaimer,
            "total_count": len(providers)
        }
    
    except Exception as e:
        logger.error(
            "provider_matching_error",
            error=str(e),
            item_type=item_type
        )
        # Return empty list on error rather than failing
        return {
            "providers": [],
            "disclaimer": "Suggestion only. Please confirm availability with the provider.",
            "total_count": 0,
            "error": str(e)
        }
