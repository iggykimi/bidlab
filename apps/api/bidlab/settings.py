"""Effective configuration. Names follow .env.example; secrets never logged."""

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    bidlab_mode: str = "demo"
    bidlab_bind_host: str = "127.0.0.1"
    bidlab_port: int = 8000
    bidlab_storage_dir: str = "./storage"
    bidlab_history_enabled: bool = False
    bidlab_meta_budget_usd: str = "20.00"
    meta_model: str = "muse-spark-1.3"
    model_api_key: str = ""

    @field_validator("bidlab_mode")
    @classmethod
    def _check_mode(cls, value: str) -> str:
        if value not in ("demo", "live", "manual"):
            raise ValueError(f"unknown BIDLAB_MODE: {value!r}")
        return value

    @property
    def storage_path(self) -> Path:
        p = Path(self.bidlab_storage_dir)
        return p if p.is_absolute() else ROOT / p

    @property
    def live_ready(self) -> bool:
        # An empty key never enables live; finding a key never flips demo mode.
        return self.bidlab_mode == "live" and bool(self.model_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
