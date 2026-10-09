from supabase import create_client, Client
from careplus.core.config import settings


def get_supabase_client(use_service_role: bool = True) -> Client:
    """
    Get a Supabase client instance.
    
    Args:
        use_service_role: If True, use service role key (bypasses RLS).
                          If False, use anon key (respects RLS).
    
    Returns:
        Supabase client instance
    """
    api_key = settings.supabase_service_role_key if use_service_role else settings.supabase_anon_key
    return create_client(settings.supabase_url, api_key)
