import json
from typing import Optional, Dict, Any, List
import httpx
from careplus.llm.base import LLMClient
from careplus.core.config import settings
from careplus.core.logging import logger


class OpenRouterClient(LLMClient):
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        default_model: Optional[str] = None
    ):
        self.api_key = api_key or settings.openrouter_api_key
        self.base_url = base_url or settings.openrouter_base_url
        self.default_model = default_model or settings.openrouter_default_model
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "HTTP-Referer": "https://careplus.health",
                "X-Title": "CarePlus Health"
            },
            timeout=60.0
        )

    async def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None
    ) -> str:
        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            response = await self._call_api(
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response
        except Exception as e:
            logger.error("openrouter_generate_error", error=str(e))
            raise

    async def generate_structured(
        self,
        prompt: str,
        schema: Dict[str, Any],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            full_prompt = f"{prompt}\n\nPlease respond in the following JSON schema:\n{json.dumps(schema, indent=2)}"
            response_text = await self.generate(
                full_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                system_prompt=system_prompt
            )
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error("openrouter_json_parse_error", error=str(e), response=response_text)
            raise
        except Exception as e:
            logger.error("openrouter_structured_error", error=str(e))
            raise

    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        model: Optional[str] = None
    ) -> str:
        try:
            message = await self.chat_with_tools(messages, tools=None, temperature=temperature, max_tokens=max_tokens, model=model)
            return message.get("content", "")
        except Exception as e:
            logger.error("openrouter_chat_error", error=str(e))
            raise

    async def chat_with_tools(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.3,
        max_tokens: Optional[int] = None,
        model: Optional[str] = None,
        tool_choice: str = "auto",
    ) -> Dict[str, Any]:
        """
        OpenAI-compatible chat completion that supports function/tool calling.
        Returns the raw assistant message dict (content + optional tool_calls).
        """
        payload: Dict[str, Any] = {
            "model": model or self.default_model,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = tool_choice
        try:
            response = await self.client.post("/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]
        except Exception as e:
            logger.error("openrouter_chat_tools_error", error=str(e))
            raise

    async def _call_api(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: Optional[int],
        model: Optional[str] = None
    ) -> str:
        payload = {
            "model": model or self.default_model,
            "messages": messages,
            "temperature": temperature
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        response = await self.client.post(
            "/chat/completions",
            json=payload
        )
        response.raise_for_status()

        data = response.json()
        return data["choices"][0]["message"]["content"]

    async def close(self):
        await self.client.aclose()
