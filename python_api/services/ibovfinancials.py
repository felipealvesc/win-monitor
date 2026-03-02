from __future__ import annotations

from typing import Any

from python_api.config import Settings
from python_api.services.http import build_url, fetch_json


def _normalize_mapping(payload: Any) -> dict[str, Any]:
    return payload if isinstance(payload, dict) else {}


def _pick_number(mapping: dict[str, Any], *keys: str) -> float | None:
    lowered = {str(key).lower(): value for key, value in mapping.items()}

    for key in keys:
        value = lowered.get(key.lower())
        if value is None:
            continue

        try:
            return float(value)
        except (TypeError, ValueError):
            continue

    return None


def _pick_value(mapping: dict[str, Any], *keys: str) -> Any:
    lowered = {str(key).lower(): value for key, value in mapping.items()}

    for key in keys:
        if key.lower() in lowered:
            return lowered[key.lower()]

    return None


class IbovFinancialsClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}

        if self.settings.ibov_token:
            headers["Authorization"] = f"Bearer {self.settings.ibov_token}"
            headers["X-API-Key"] = self.settings.ibov_token
            headers["x-api-key"] = self.settings.ibov_token

        return headers

    def _request(self, path: str, params: dict[str, Any]) -> Any:
        request_params = dict(params)
        if self.settings.ibov_token:
            request_params.setdefault("token", self.settings.ibov_token)

        url = build_url(self.settings.ibov_base_url, path, request_params)
        return fetch_json(
            url,
            headers=self._headers(),
            timeout=self.settings.ibov_timeout_seconds,
        )

    def get_quote(self, symbol: str) -> dict[str, Any]:
        raw = self._request("/api/ibov/quotes/", {"symbol": symbol.upper()})
        payload = _normalize_mapping(raw)

        return {
            "source": "ibovfinancials",
            "symbol": symbol.upper(),
            "last": _pick_number(
                payload,
                "last",
                "price",
                "close",
                "last_price",
                "current_price",
            ),
            "open": _pick_number(payload, "open", "open_price"),
            "high": _pick_number(payload, "high", "high_price"),
            "low": _pick_number(payload, "low", "low_price"),
            "bid": _pick_number(payload, "bid", "best_bid"),
            "ask": _pick_number(payload, "ask", "best_ask"),
            "volume": _pick_number(payload, "volume", "financial_volume"),
            "timestamp": _pick_value(payload, "timestamp", "datetime", "time"),
            "raw": raw,
        }

    def get_book(self, symbol: str) -> dict[str, Any]:
        raw = self._request("/api/ibov/book/", {"symbol": symbol.upper()})
        payload = _normalize_mapping(raw)

        bids = payload.get("bids") or payload.get("buy") or []
        asks = payload.get("asks") or payload.get("sell") or []

        return {
            "source": "ibovfinancials",
            "symbol": symbol.upper(),
            "bids": bids,
            "asks": asks,
            "raw": raw,
        }

    def get_historical(
        self,
        symbol: str,
        *,
        timeframe: int = 5,
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int = 300,
    ) -> dict[str, Any]:
        raw = self._request(
            "/api/ibov/historical/",
            {
                "symbol": symbol.upper(),
                "timeframe": timeframe,
                "start_date": start_date,
                "end_date": end_date,
                "limit": limit,
            },
        )
        payload = _normalize_mapping(raw)
        candles = payload.get("data") or payload.get("candles") or payload.get("results") or []

        return {
            "source": "ibovfinancials",
            "symbol": symbol.upper(),
            "timeframe": timeframe,
            "candles": candles,
            "raw": raw,
        }
