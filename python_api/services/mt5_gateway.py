from __future__ import annotations

import importlib
from pathlib import Path
from typing import Any

from python_api.config import Settings


def _safe_asdict(value: Any) -> dict[str, Any]:
    if value is None:
        return {}

    if hasattr(value, "_asdict"):
        return value._asdict()

    if isinstance(value, dict):
        return value

    result: dict[str, Any] = {}
    for key in dir(value):
        if key.startswith("_"):
            continue

        try:
            current = getattr(value, key)
        except AttributeError:
            continue

        if callable(current):
            continue

        result[key] = current

    return result


def _tail(path: Path, limit: int = 15) -> list[str]:
    if not path.exists():
        return []

    content = path.read_text(encoding="utf-8", errors="ignore")
    return [line.strip() for line in content.splitlines() if line.strip()][-limit:]


def _mtime(path: Path) -> float:
    try:
        return path.stat().st_mtime
    except OSError:
        return 0


def _rate_row_to_dict(row: Any) -> dict[str, Any]:
    if isinstance(row, dict):
        return row

    dtype = getattr(row, "dtype", None)
    names = getattr(dtype, "names", None)
    if names:
        payload: dict[str, Any] = {}
        for name in names:
            value = row[name]
            payload[name] = value.item() if hasattr(value, "item") else value
        return payload

    return _safe_asdict(row)


class Mt5Gateway:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._mt5 = self._load_mt5_module()

    @staticmethod
    def _load_mt5_module() -> Any | None:
        try:
            return importlib.import_module("MetaTrader5")
        except ImportError:
            return None

    def _terminal_root(self) -> Path:
        return Path(self.settings.terminal_root)

    def _latest_terminal_data_path(self) -> Path | None:
        root = self._terminal_root()
        if not root.exists():
            return None

        candidates = [
            child
            for child in root.iterdir()
            if child.is_dir() and child.name not in {"Common", "Community"}
        ]
        if not candidates:
            return None

        return sorted(candidates, key=_mtime, reverse=True)[0]

    def _latest_log_file(self) -> Path | None:
        data_path = self._latest_terminal_data_path()
        if data_path is None:
            return None

        logs_path = data_path / "Logs"
        if not logs_path.exists():
            return None

        log_files = [child for child in logs_path.iterdir() if child.is_file() and child.suffix == ".log"]
        if not log_files:
            return None

        return sorted(log_files, key=_mtime, reverse=True)[0]

    def _connect(self) -> tuple[bool, str | None]:
        if self._mt5 is None:
            return False, "MetaTrader5 package nao esta instalado no Python atual."

        if getattr(self._mt5, "terminal_info", None) and self._mt5.terminal_info() is not None:
            return True, None

        terminal_path = self.settings.mt5_terminal_path
        initialized = self._mt5.initialize(
            path=terminal_path if Path(terminal_path).exists() else None,
            timeout=self.settings.mt5_timeout_seconds * 1000,
        )
        if initialized:
            return True, None

        last_error = self._mt5.last_error()
        return False, f"Falha ao conectar no MT5: {last_error}"

    def _resolve_symbol(self, symbol: str) -> str:
        suffix = self.settings.mt5_symbol_suffix.strip()
        return f"{symbol.upper()}{suffix}" if suffix else symbol.upper()

    def get_status(self) -> dict[str, Any]:
        log_file = self._latest_log_file()
        data_path = self._latest_terminal_data_path()
        recent_logs = _tail(log_file) if log_file else []
        response: dict[str, Any] = {
            "terminal_detected": Path(self.settings.mt5_terminal_path).exists(),
            "terminal_path": self.settings.mt5_terminal_path,
            "data_path": str(data_path) if data_path else None,
            "latest_log_file": str(log_file) if log_file else None,
            "python_bridge_available": self._mt5 is not None,
            "recent_log_entries": recent_logs,
        }

        ok, error = self._connect()
        if not ok:
            response["bridge_error"] = error
            return response

        terminal_info = _safe_asdict(self._mt5.terminal_info())
        account_info = _safe_asdict(self._mt5.account_info())
        version_info = self._mt5.version() or ()
        positions = self._mt5.positions_get() or []
        orders = self._mt5.orders_get() or []

        response.update(
            {
                "version": list(version_info),
                "terminal_info": terminal_info,
                "account_info": account_info,
                "positions_total": len(positions),
                "orders_total": len(orders),
            }
        )
        return response

    def get_symbol_snapshot(self, symbol: str) -> dict[str, Any]:
        ok, error = self._connect()
        if not ok:
            return {"symbol": symbol.upper(), "error": error}

        resolved_symbol = self._resolve_symbol(symbol)
        self._mt5.symbol_select(resolved_symbol, True)
        tick = _safe_asdict(self._mt5.symbol_info_tick(resolved_symbol))
        info = _safe_asdict(self._mt5.symbol_info(resolved_symbol))

        return {
            "symbol": resolved_symbol,
            "tick": tick,
            "info": info,
            "last": tick.get("last") or tick.get("bid") or tick.get("ask"),
            "bid": tick.get("bid"),
            "ask": tick.get("ask"),
            "volume_real": tick.get("volume_real"),
            "time": tick.get("time"),
        }

    def get_book(self, symbol: str) -> dict[str, Any]:
        ok, error = self._connect()
        if not ok:
            return {"symbol": symbol.upper(), "error": error}

        resolved_symbol = self._resolve_symbol(symbol)
        self._mt5.symbol_select(resolved_symbol, True)

        if not hasattr(self._mt5, "market_book_add"):
            return {
                "symbol": resolved_symbol,
                "error": "Bridge MetaTrader5 nao expoe market_book_add nesta instalacao.",
            }

        added = self._mt5.market_book_add(resolved_symbol)
        if not added:
            return {
                "symbol": resolved_symbol,
                "error": f"Falha ao assinar book: {self._mt5.last_error()}",
            }

        try:
            book = self._mt5.market_book_get(resolved_symbol) or []
            entries = [_safe_asdict(item) for item in book]
        finally:
            self._mt5.market_book_release(resolved_symbol)

        return {
            "symbol": resolved_symbol,
            "entries": entries,
        }

    def get_historical(
        self,
        symbol: str,
        *,
        timeframe: str = "M5",
        limit: int = 300,
    ) -> dict[str, Any]:
        ok, error = self._connect()
        if not ok:
            return {"symbol": symbol.upper(), "error": error}

        resolved_symbol = self._resolve_symbol(symbol)
        self._mt5.symbol_select(resolved_symbol, True)
        timeframe_name = f"TIMEFRAME_{timeframe.upper()}"
        timeframe_value = getattr(self._mt5, timeframe_name, None)

        if timeframe_value is None:
            return {
                "symbol": resolved_symbol,
                "error": f"Timeframe invalido: {timeframe}",
            }

        rates = self._mt5.copy_rates_from_pos(resolved_symbol, timeframe_value, 0, limit)
        candles = []
        for row in rates or []:
            candle = _rate_row_to_dict(row)
            candles.append(candle)

        return {
            "symbol": resolved_symbol,
            "timeframe": timeframe.upper(),
            "candles": candles,
        }
