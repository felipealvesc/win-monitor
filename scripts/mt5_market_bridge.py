from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import MetaTrader5 as mt5

POINT_VALUE = 0.2
DEFAULT_TERMINAL_PATH = Path(r"C:\Program Files\MetaTrader 5 Terminal\terminal64.exe")

TIMEFRAME_MAP = {
    "1m": mt5.TIMEFRAME_M1,
    "5m": mt5.TIMEFRAME_M5,
    "15m": mt5.TIMEFRAME_M15,
    "30m": mt5.TIMEFRAME_M30,
    "60m": mt5.TIMEFRAME_H1,
    "1d": mt5.TIMEFRAME_D1,
}

RANGE_TO_DAYS = {
    "1d": 1,
    "5d": 5,
    "1mo": 30,
    "3mo": 90,
    "6mo": 180,
    "1y": 365,
    "2y": 730,
    "5y": 1825,
    "10y": 3650,
    "ytd": 365,
    "max": 5000,
}

INTERVAL_TO_MINUTES = {
    "1m": 1,
    "5m": 5,
    "15m": 15,
    "30m": 30,
    "60m": 60,
    "1d": 1440,
}


def emit(payload: Any, status: int = 0) -> None:
    print(json.dumps(payload, ensure_ascii=False))
    raise SystemExit(status)


def initialize() -> None:
    terminal_path = str(DEFAULT_TERMINAL_PATH) if DEFAULT_TERMINAL_PATH.exists() else None
    ok = mt5.initialize(path=terminal_path)
    if not ok:
        emit({"error": f"Falha ao inicializar MT5: {mt5.last_error()}"}, 1)


def shutdown() -> None:
    try:
        mt5.shutdown()
    except Exception:
        pass


def to_float(value: Any, fallback: float = 0.0) -> float:
    try:
        number = float(value)
        if math.isnan(number) or math.isinf(number):
            return fallback
        return number
    except (TypeError, ValueError):
        return fallback


def to_iso(unix_seconds: int | float | None) -> str:
    if not unix_seconds:
        return datetime.now(timezone.utc).isoformat()
    return datetime.fromtimestamp(unix_seconds, tz=timezone.utc).isoformat()


def ensure_symbol(symbol: str) -> str:
    resolved = symbol.upper()
    selected = mt5.symbol_select(resolved, True)
    if not selected:
        emit({"error": f"Símbolo não disponível no MT5: {resolved}"}, 1)
    return resolved


def range_to_limit(interval: str, range_name: str) -> int:
    days = RANGE_TO_DAYS.get(range_name, 30)
    minutes = INTERVAL_TO_MINUTES.get(interval, 1440)
    bars_per_day = max(1, round((24 * 60) / minutes))
    return max(10, min(days * bars_per_day, 5000))


def quote(symbol: str) -> None:
    resolved = ensure_symbol(symbol)
    tick = mt5.symbol_info_tick(resolved)
    if tick is None:
        emit({"error": f"Tick não encontrado para {resolved}"}, 1)

    daily_rates = mt5.copy_rates_from_pos(resolved, mt5.TIMEFRAME_D1, 0, 2)
    if daily_rates is None or len(daily_rates) == 0:
        emit({"error": f"Sem candles diários para {resolved}"}, 1)

    current_day = daily_rates[0]
    previous_day = daily_rates[1] if len(daily_rates) > 1 else daily_rates[0]
    current_price = to_float(getattr(tick, "last", None)) or to_float(getattr(tick, "bid", None)) or to_float(getattr(tick, "ask", None))
    day_open = to_float(current_day["open"])
    previous_close = to_float(previous_day["close"], day_open)
    change_percent = ((current_price - previous_close) / previous_close * 100) if previous_close else 0
    change_points = round((current_price - day_open) / POINT_VALUE) if day_open else 0

    emit(
        {
            "symbol": resolved,
            "currentPrice": current_price,
            "dayOpen": day_open,
            "dayHigh": to_float(current_day["high"], current_price),
            "dayLow": to_float(current_day["low"], current_price),
            "volume": to_float(current_day["real_volume"] or current_day["tick_volume"]),
            "previousClose": previous_close,
            "changePercent": round(change_percent, 2),
            "changePoints": change_points,
            "timestamp": to_iso(getattr(tick, "time", None)),
            "currency": "BRL",
            "name": resolved,
            "bid": to_float(getattr(tick, "bid", None)),
            "ask": to_float(getattr(tick, "ask", None)),
            "last": to_float(getattr(tick, "last", None), current_price),
        }
    )


def historical(symbol: str, interval: str, range_name: str) -> None:
    resolved = ensure_symbol(symbol)
    timeframe = TIMEFRAME_MAP.get(interval, mt5.TIMEFRAME_D1)
    limit = range_to_limit(interval, range_name)
    rates = mt5.copy_rates_from_pos(resolved, timeframe, 0, limit)

    if rates is None:
        emit({"error": f"Sem histórico para {resolved} em {interval}"}, 1)

    results = []
    for row in rates:
        results.append(
            {
                "t": int(row["time"]) * 1000,
                "o": to_float(row["open"]),
                "h": to_float(row["high"]),
                "l": to_float(row["low"]),
                "c": to_float(row["close"]),
                "v": to_float(row["real_volume"] or row["tick_volume"]),
            }
        )

    emit(
        {
            "symbol": resolved,
            "interval": interval,
            "range": range_name,
            "results": results,
        }
    )


def symbols() -> None:
    items = mt5.symbols_get() or []
    filtered = [item.name for item in items if item.name.upper().startswith("WIN")]
    emit({"symbols": sorted(filtered)[:200]})


def main() -> None:
    if len(sys.argv) < 2:
        emit({"error": "Comando obrigatório"}, 1)

    command = sys.argv[1]
    initialize()

    try:
        if command == "quote":
            quote(sys.argv[2])
        if command == "historical":
            historical(sys.argv[2], sys.argv[3], sys.argv[4])
        if command == "symbols":
            symbols()
        emit({"error": f"Comando inválido: {command}"}, 1)
    finally:
        shutdown()


if __name__ == "__main__":
    main()
