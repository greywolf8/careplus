import pytest
import os
from careplus.core.config import settings


@pytest.fixture
def mock_env_vars():
    old_env = os.environ.copy()
    os.environ["SUPABASE_URL"] = "https://test.supabase.co"
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "test-key"
    os.environ["SUPABASE_ANON_KEY"] = "test-anon-key"
    os.environ["GEMINI_API_KEY"] = "test-gemini-key"
    os.environ["JWT_SECRET"] = "test-secret"
    os.environ["JWT_ALGORITHM"] = "HS256"
    os.environ["LOG_LEVEL"] = "INFO"
    os.environ["ENVIRONMENT"] = "test"
    
    yield
    
    os.environ.clear()
    os.environ.update(old_env)
