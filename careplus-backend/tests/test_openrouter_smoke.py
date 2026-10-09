import pytest
from careplus.llm import OpenRouterClient
from careplus.core.config import settings


@pytest.mark.asyncio
async def test_openrouter_chat_call():
    """Smoke test: verify OpenRouter client can make a successful API call."""
    client = OpenRouterClient()

    try:
        response = await client.chat(
            messages=[{"role": "user", "content": "Say 'OK' and nothing else."}],
            temperature=0.0
        )
        assert response is not None
        assert len(response) > 0
        assert "OK" in response.upper()
    finally:
        await client.close()


@pytest.mark.asyncio
async def test_openrouter_with_custom_model():
    """Test that custom model parameter works."""
    client = OpenRouterClient()

    try:
        response = await client.chat(
            messages=[{"role": "user", "content": "Say 'test'"}],
            temperature=0.0,
            model=settings.openrouter_default_model
        )
        assert response is not None
    finally:
        await client.close()
