"""Effective configuration. Names follow .env.example; secrets never logged."""

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]

BidLabMode = Literal["demo", "live", "manual"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    bidlab_mode: BidLabMode = "demo"
    bidlab_bind_host: str = "127.0.0.1"
    bidlab_port: int = 8000
    bidlab_storage_dir: str = "./storage"
    bidlab_history_enabled: bool = False
    bidlab_meta_budget_usd: str = "20.00"
    meta_model: str = "muse-spark-1.3"
    model_api_key: SecretStr = SecretStr("")

    @property
    def storage_path(self) -> Path:
        p = Path(self.bidlab_storage_dir)
        return p if p.is_absolute() else ROOT / p

    @property
    def live_ready(self) -> bool:
        # An empty key never enables live; finding a key never flips demo mode.
        # NOTE: SecretStr is always truthy; unwrap before the emptiness check.
        # The adapter reads META_API_URL from the process environment only,
        # so live is ready only when the URL is there too.
        return (
            self.bidlab_mode == "live"
            and self.meta_model == "muse-spark-1.3"
            and bool(self.model_api_key.get_secret_value())
            and bool(os.environ.get("META_API_URL"))
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
