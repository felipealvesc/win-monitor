from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


def _default_appdata() -> str:
    return os.getenv(
        "APPDATA",
        str(Path.home() / "AppData" / "Roaming"),
    )


@dataclass(frozen=True)
class Settings:
    host: str = os.getenv("PY_API_HOST", "0.0.0.0")
    port: int = int(os.getenv("PY_API_PORT", "3001"))
    cors_origins: str = os.getenv("PY_API_CORS_ORIGINS", "*")
    ibov_base_url: str = os.getenv("IBOV_BASE_URL", "https://www.ibovfinancials.com")
    ibov_token: str = os.getenv("IBOV_TOKEN", "")
    ibov_timeout_seconds: float = float(os.getenv("IBOV_TIMEOUT_SECONDS", "15"))
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    openai_timeout_seconds: float = float(os.getenv("OPENAI_TIMEOUT_SECONDS", "40"))
    mt5_terminal_path: str = os.getenv(
        "MT5_TERMINAL_PATH",
        r"C:\Program Files\MetaTrader 5 Terminal\terminal64.exe",
    )
    mt5_symbol_suffix: str = os.getenv("MT5_SYMBOL_SUFFIX", "")
    mt5_timeout_seconds: int = int(os.getenv("MT5_TIMEOUT_SECONDS", "10"))
    terminal_root: str = os.getenv(
        "MT5_TERMINAL_ROOT",
        str(Path(_default_appdata()) / "MetaQuotes" / "Terminal"),
    )
    news_rss_base_url: str = os.getenv(
        "NEWS_RSS_BASE_URL",
        "https://news.google.com/rss/search",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]

        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
