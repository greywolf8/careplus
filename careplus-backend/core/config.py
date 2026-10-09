from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str
    openrouter_api_key: str
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_default_model: str = "openai/gpt-4o-mini"
    extractor_a_model: str = "openai/gpt-4o-mini"
    extractor_b_model: str = "openai/gpt-4o-mini"
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    log_level: str = "INFO"
    environment: str = "development"


settings = Settings()
