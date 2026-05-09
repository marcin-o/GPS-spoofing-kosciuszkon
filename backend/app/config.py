from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    frontend_origin: str = "http://localhost:3000"

    opensky_client_id: str | None = None
    opensky_client_secret: str | None = None
    opensky_token_url: str = (
        "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
    )
    opensky_states_url: str = "https://opensky-network.org/api/states/all"

    aisstream_api_key: str | None = None

    tts_enabled: bool = True
    model_dir: str = str(Path(__file__).resolve().parents[2] / "ml" / "models")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
