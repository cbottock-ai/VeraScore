from pathlib import Path

from pydantic_settings import BaseSettings

_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    app_name: str = "VeraScore API"
    debug: bool = False

    database_url: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    redis_url: str = ""

    alpha_vantage_api_key: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    fmp_api_key: str = ""

    llm_provider: str = "anthropic"
    llm_model: str = ""

    model_config = {"env_file": str(_ENV_FILE), "env_file_encoding": "utf-8"}


settings = Settings()
