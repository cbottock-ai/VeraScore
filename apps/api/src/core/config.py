from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "VeraScore API"
    debug: bool = False

    database_url: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    redis_url: str = ""

    alpha_vantage_api_key: str = ""
    anthropic_api_key: str = ""
    fmp_api_key: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
