from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from python_api.services.ibovfinancials import IbovFinancialsClient
from python_api.services.mt5_gateway import Mt5Gateway
from python_api.services.news import NewsService
from python_api.services.openai_client import OpenAIAnalysisClient

POINT_DIVISOR = 1.0


def _round(value: float, precision: int = 2) -> float:
    if value is None:
        return 0.0
    try:
        return round(float(value), precision)
    except (TypeError, ValueError):
        return 0.0


def _average(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def _std(values: list[float]) -> float:
    if not values:
        return 0.0
    mean = _average(values)
    variance = _average([(value - mean) ** 2 for value in values])
    return variance ** 0.5


def _clamp(value: float, low: float, high: float) -> float:
    return min(max(value, low), high)


def _sma(values: list[float], period: int) -> float:
    if not values:
        return 0.0
    window = values[-min(period, len(values)) :]
    return _average(window)


def _rsi(values: list[float], period: int = 14) -> float:
    if len(values) < 2:
        return 50.0

    changes = [values[index] - values[index - 1] for index in range(1, len(values))]
    window = changes[-min(period, len(changes)) :]
    gains = [change for change in window if change > 0]
    losses = [abs(change) for change in window if change < 0]
    avg_gain = _average(gains)
    avg_loss = _average(losses)

    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0

    rs = avg_gain / avg_loss
    return _round(100 - (100 / (1 + rs)))


def _pick_number(payload: dict[str, Any], *keys: str) -> float | None:
    lowered = {str(key).lower(): value for key, value in payload.items()}
    for key in keys:
        value = lowered.get(key.lower())
        if value is None:
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return None


def _pick_value(payload: dict[str, Any], *keys: str) -> Any:
    lowered = {str(key).lower(): value for key, value in payload.items()}
    for key in keys:
        if key.lower() in lowered:
            return lowered[key.lower()]
    return None


def _to_iso(value: Any) -> str:
    if isinstance(value, str) and value.strip():
        return value
    if isinstance(value, (int, float)):
        if value > 10_000_000_000:
            value = value / 1000
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()
        except (OverflowError, OSError, ValueError):
            pass
    return datetime.now(timezone.utc).isoformat()


def _normalize_candle(row: Any, mode: str) -> dict[str, Any]:
    payload = row if isinstance(row, dict) else {}
    timestamp = _pick_value(payload, 't', 'time', 'timestamp', 'datetime')
    open_value = _pick_number(payload, 'o', 'open') or 0.0
    high_value = _pick_number(payload, 'h', 'high') or 0.0
    low_value = _pick_number(payload, 'l', 'low') or 0.0
    close_value = _pick_number(payload, 'c', 'close', 'last') or 0.0
    volume_value = _pick_number(payload, 'v', 'volume', 'tick_volume', 'real_volume') or 0.0
    iso = _to_iso(timestamp)
    dt = datetime.fromisoformat(iso.replace('Z', '+00:00'))
    label = dt.strftime('%H:%M') if mode == 'intraday' else dt.strftime('%d/%m')
    return {
        'timestamp': iso,
        'label': label,
        'open': _round(open_value),
        'high': _round(high_value),
        'low': _round(low_value),
        'close': _round(close_value),
        'volume': _round(volume_value, 0),
    }


def _returns_profile(bars: list[dict[str, Any]]) -> dict[str, float]:
    closes = [bar['close'] for bar in bars]
    returns = []
    for index in range(1, len(closes)):
        previous = closes[index - 1]
        current = closes[index]
        returns.append(((current - previous) / previous) * 100 if previous else 0.0)

    positive = [value for value in returns if value > 0]
    negative = [value for value in returns if value < 0]
    ranges = [((bar['high'] - bar['low']) / bar['open']) * 100 if bar['open'] else 0.0 for bar in bars]
    volumes = [bar['volume'] for bar in bars[-20:]]

    return {
        'avgDailyReturn': _round(_average(returns)),
        'avgPositiveReturn': _round(_average(positive)),
        'avgNegativeReturn': _round(_average(negative)),
        'avgDailyRange': _round(_average(ranges)),
        'typicalDailyMove': _round(_average([abs(value) for value in returns]) or 0.7),
        'volatility': _round(_std(returns)),
        'positiveCloseRate': _round((len(positive) / max(len(returns), 1)) * 100),
        'last20AverageVolume': _round(_average(volumes), 0),
    }


def _support(bars: list[dict[str, Any]], lookback: int = 20) -> float:
    window = bars[-min(lookback, len(bars)) :]
    return _round(min((bar['low'] for bar in window), default=0.0))


def _resistance(bars: list[dict[str, Any]], lookback: int = 20) -> float:
    window = bars[-min(lookback, len(bars)) :]
    return _round(max((bar['high'] for bar in window), default=0.0))


def _analyze_timeframe(bars: list[dict[str, Any]], timeframe: str) -> dict[str, Any]:
    closes = [bar['close'] for bar in bars]
    current_price = closes[-1] if closes else 0.0
    reference_index = max(0, len(closes) - 6)
    momentum_index = max(0, len(closes) - 3)
    reference_price = closes[reference_index] if closes else current_price
    momentum_reference = closes[momentum_index] if closes else current_price
    sma9 = _round(_sma(closes, 9))
    sma21 = _round(_sma(closes, 21))
    sma50 = _round(_sma(closes, 50))
    slope_percent = _round(((current_price - reference_price) / reference_price) * 100 if reference_price else 0.0)
    momentum_percent = _round(((current_price - momentum_reference) / momentum_reference) * 100 if momentum_reference else 0.0)

    trend = 'sideways'
    if current_price >= sma9 >= sma21 and slope_percent > 0:
        trend = 'uptrend'
    elif current_price <= sma9 <= sma21 and slope_percent < 0:
        trend = 'downtrend'

    distance_score = abs((sma9 - sma21) / current_price) * 2000 if current_price else 0.0
    strength = _round(_clamp(abs(slope_percent) * 12 + abs(momentum_percent) * 8 + distance_score, 0, 100))

    return {
        'timeframe': timeframe,
        'trend': trend,
        'strength': strength,
        'support': _support(bars),
        'resistance': _resistance(bars),
        'price': _round(current_price),
        'sma9': sma9,
        'sma21': sma21,
        'sma50': sma50,
        'slopePercent': slope_percent,
        'momentumPercent': momentum_percent,
    }


class FusionAnalyzer:
    def __init__(
        self,
        ibov_client: IbovFinancialsClient,
        mt5_gateway: Mt5Gateway,
        news_service: NewsService,
        openai_client: OpenAIAnalysisClient,
    ) -> None:
        self.ibov_client = ibov_client
        self.mt5_gateway = mt5_gateway
        self.news_service = news_service
        self.openai_client = openai_client

    def _fetch_historical(self, symbol: str, timeframe: str, limit: int, mode: str) -> list[dict[str, Any]]:
        mt5_response = self.mt5_gateway.get_historical(symbol, timeframe=timeframe, limit=limit)
        mt5_candles = mt5_response.get('candles') if isinstance(mt5_response, dict) else None
        if isinstance(mt5_candles, list) and mt5_candles:
            return [_normalize_candle(item, mode) for item in mt5_candles]

        timeframe_map = {'M5': 5, 'H1': 60, 'D1': 1440}
        ibov_response = self.ibov_client.get_historical(symbol, timeframe=timeframe_map.get(timeframe, 5), limit=limit)
        ibov_candles = ibov_response.get('candles') if isinstance(ibov_response, dict) else None
        return [_normalize_candle(item, mode) for item in ibov_candles or []]

    def _fetch_market_data(self, symbol: str, daily_bars: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any]]:
        mt5_snapshot = self.mt5_gateway.get_symbol_snapshot(symbol)
        ibov_quote = self.ibov_client.get_quote(symbol)

        current_price = _pick_number(mt5_snapshot, 'last', 'bid', 'ask')
        if current_price is None:
            current_price = _pick_number(ibov_quote, 'last', 'price', 'close', 'current_price') or 0.0

        day_open = _pick_number(ibov_quote, 'open') or (daily_bars[-1]['open'] if daily_bars else current_price)
        day_high = _pick_number(ibov_quote, 'high') or (daily_bars[-1]['high'] if daily_bars else current_price)
        day_low = _pick_number(ibov_quote, 'low') or (daily_bars[-1]['low'] if daily_bars else current_price)
        volume = _pick_number(ibov_quote, 'volume') or _pick_number(mt5_snapshot, 'volume_real', 'volume') or 0.0
        previous_close = daily_bars[-2]['close'] if len(daily_bars) > 1 else current_price
        close_change_percent = ((current_price - previous_close) / previous_close) * 100 if previous_close else 0.0
        session_change_percent = ((current_price - day_open) / day_open) * 100 if day_open else 0.0
        change_points = round((current_price - day_open) / POINT_DIVISOR) if day_open else 0
        timestamp = _to_iso(_pick_value(mt5_snapshot, 'time', 'timestamp') or ibov_quote.get('timestamp'))

        market_data = {
            'symbol': symbol.upper(),
            'currentPrice': _round(current_price),
            'dayOpen': _round(day_open),
            'dayHigh': _round(day_high),
            'dayLow': _round(day_low),
            'volume': _round(volume, 0),
            'previousClose': _round(previous_close),
            'timestamp': timestamp,
            'changePercent': _round(session_change_percent),
            'changePoints': change_points,
            'closeChangePercent': _round(close_change_percent),
        }
        return market_data, {
            'mt5Snapshot': mt5_snapshot,
            'ibovQuote': ibov_quote,
        }

    def _infer_bias(self, trends: list[dict[str, Any]]) -> str:
        bullish = len([trend for trend in trends if trend['trend'] == 'uptrend'])
        bearish = len([trend for trend in trends if trend['trend'] == 'downtrend'])
        if bullish > bearish:
            return 'bullish'
        if bearish > bullish:
            return 'bearish'
        return 'neutral'

    def _build_trade_setup(
        self,
        market_data: dict[str, Any],
        direction: str,
        bias: str,
        account_size: float,
        risk_percentage: float,
        support: float,
        resistance: float,
        profile: dict[str, float],
    ) -> dict[str, Any]:
        setup_direction = direction
        if setup_direction == 'WAIT':
            setup_direction = 'BUY' if bias == 'bullish' else 'SELL' if bias == 'bearish' else 'WAIT'

        entry_price = market_data['currentPrice']
        movement_percent = max(profile['typicalDailyMove'], 0.7)
        default_distance = max(entry_price * (movement_percent / 100) * 0.55, 30)
        stop_price = entry_price
        target_price = entry_price
        stop_points = 0
        target_points = 0

        if setup_direction == 'BUY':
            candidate_stop = min(support or entry_price - default_distance, market_data['dayLow'] or entry_price - default_distance)
            stop_price = _round(candidate_stop if candidate_stop < entry_price else entry_price - default_distance)
            stop_points = max(10, round((entry_price - stop_price) / POINT_DIVISOR))
            target_points = max(round(stop_points * 1.8), round(((movement_percent / 100) * entry_price) / POINT_DIVISOR))
            target_price = _round(entry_price + target_points * POINT_DIVISOR)
        elif setup_direction == 'SELL':
            candidate_stop = max(resistance or entry_price + default_distance, market_data['dayHigh'] or entry_price + default_distance)
            stop_price = _round(candidate_stop if candidate_stop > entry_price else entry_price + default_distance)
            stop_points = max(10, round((stop_price - entry_price) / POINT_DIVISOR))
            target_points = max(round(stop_points * 1.8), round(((movement_percent / 100) * entry_price) / POINT_DIVISOR))
            target_price = _round(entry_price - target_points * POINT_DIVISOR)

        max_risk_amount = _round(account_size * (risk_percentage / 100))
        contracts_allowed = 0 if setup_direction == 'WAIT' or stop_points <= 0 else max(0, int(max_risk_amount // stop_points))
        risk_reward_ratio = _round(target_points / stop_points if stop_points > 0 else 0.0)

        return {
            'direction': setup_direction,
            'entryPrice': _round(entry_price),
            'stopPrice': _round(stop_price),
            'targetPrice': _round(target_price),
            'stopPoints': int(stop_points),
            'targetPoints': int(target_points),
            'riskRewardRatio': risk_reward_ratio,
            'maxRiskAmount': max_risk_amount,
            'contractsAllowed': contracts_allowed,
            'riskPercentage': risk_percentage,
            'support': _round(support),
            'resistance': _round(resistance),
        }

    def _ai_summary(self, symbol: str, payload: dict[str, Any]) -> str | None:
        if not self.openai_client.enabled:
            return None
        prompt = (
            f"Você é um analista intraday do mini índice. Resuma em até 6 linhas o contexto de {symbol}.\n"
            "Retorne: cenário, drivers, confirmação, invalidação e risco de evento.\n"
            f"Dados: {json.dumps(payload, ensure_ascii=False)[:5000]}"
        )
        response = self.openai_client.analyze_market_context(prompt)
        return response.get('analysis') if isinstance(response, dict) else None

    def analyze(
        self,
        symbol: str,
        *,
        account_size: float = 10000,
        risk_percentage: float = 1.0,
        news_query: str | None = None,
        max_news: int = 8,
        max_data_age_minutes: int = 90,
    ) -> dict[str, Any]:
        intraday_bars = self._fetch_historical(symbol, 'M5', 300, 'intraday')
        hourly_bars = self._fetch_historical(symbol, 'H1', 300, 'intraday')
        daily_bars = self._fetch_historical(symbol, 'D1', 200, 'daily')
        news = self.news_service.get_market_impact_news(symbol, query=news_query, max_items=max_news)
        market_data, raw_sources = self._fetch_market_data(symbol, daily_bars)

        trend_analysis = [
            _analyze_timeframe(intraday_bars, '5m'),
            _analyze_timeframe(hourly_bars, '60m'),
            _analyze_timeframe(daily_bars, '1d'),
        ]
        daily_profile = _returns_profile(daily_bars)
        bias = self._infer_bias(trend_analysis)
        support_candidates = [market_data['dayLow']] + [item for item in [_support(intraday_bars), _support(hourly_bars), _support(daily_bars)] if item > 0]
        resistance_candidates = [market_data['dayHigh']] + [item for item in [_resistance(intraday_bars), _resistance(hourly_bars), _resistance(daily_bars)] if item > 0]
        support = _round(min(support_candidates)) if support_candidates else 0.0
        resistance = _round(max(resistance_candidates)) if resistance_candidates else 0.0
        bullish_alignment = all(item['trend'] == 'uptrend' for item in trend_analysis)
        bearish_alignment = all(item['trend'] == 'downtrend' for item in trend_analysis)
        alignment_multiframe = bullish_alignment or bearish_alignment
        direction_candidate = 'BUY' if bullish_alignment else 'SELL' if bearish_alignment else 'WAIT'
        intraday_window = intraday_bars[-20:]
        latest_intraday_volume = intraday_window[-1]['volume'] if intraday_window else 0.0
        intraday_avg_volume = _average([bar['volume'] for bar in intraday_window])
        volume_ratio = _round(latest_intraday_volume / intraday_avg_volume if intraday_avg_volume else 0.0)
        volume_above_average = volume_ratio >= 1.05
        session_range = market_data['dayHigh'] - market_data['dayLow']
        range_position = _round((market_data['currentPrice'] - market_data['dayLow']) / session_range, 4) if session_range > 0 else 0.5
        recent_breakout_high = _resistance(intraday_bars[:-1], 12) or resistance
        recent_breakout_low = _support(intraday_bars[:-1], 12) or support
        breakout_confirmed = False
        if direction_candidate == 'BUY':
            breakout_confirmed = market_data['currentPrice'] >= recent_breakout_high * 0.999 and range_position >= 0.7
        elif direction_candidate == 'SELL':
            breakout_confirmed = market_data['currentPrice'] <= recent_breakout_low * 1.001 and range_position <= 0.3
        daily_closes = [bar['close'] for bar in daily_bars]
        hourly_closes = [bar['close'] for bar in hourly_bars]
        rsi = _rsi(hourly_closes if hourly_closes else daily_closes)
        daily_sma20 = _sma(daily_closes, 20)
        technical_alignment = False
        if direction_candidate == 'BUY':
            technical_alignment = market_data['currentPrice'] >= daily_sma20 and 55 <= rsi <= 78
        elif direction_candidate == 'SELL':
            technical_alignment = market_data['currentPrice'] <= daily_sma20 and 22 <= rsi <= 45
        moved_one_percent = abs(market_data['changePercent']) >= 1
        confirmed_direction = direction_candidate if moved_one_percent and alignment_multiframe and technical_alignment and breakout_confirmed and volume_above_average else 'WAIT'
        trade_setup = self._build_trade_setup(market_data, confirmed_direction, bias, account_size, risk_percentage, support, resistance, daily_profile)
        average_strength = _average([item['strength'] for item in trend_analysis])
        conditions_matched = len([item for item in [moved_one_percent, alignment_multiframe, technical_alignment, breakout_confirmed, volume_above_average] if item])
        confidence_base = conditions_matched * 16 + average_strength * 0.45 + abs(market_data['changePercent']) * 8
        confidence = _round(_clamp(confidence_base if confirmed_direction != 'WAIT' else confidence_base * 0.75, 0, 100 if confirmed_direction != 'WAIT' else 79))
        last_bar_iso = intraday_bars[-1]['timestamp'] if intraday_bars else market_data['timestamp']
        last_bar_dt = datetime.fromisoformat(str(last_bar_iso).replace('Z', '+00:00'))
        is_fresh = (datetime.now(timezone.utc) - last_bar_dt).total_seconds() <= max_data_age_minutes * 60
        news_items = news.get('items', []) if isinstance(news, dict) else []
        event_risks = [item.get('title', '') for item in news_items[:3] if isinstance(item, dict)]
        regime = 'trend_up' if bias == 'bullish' and range_position >= 0.65 else 'trend_down' if bias == 'bearish' and range_position <= 0.35 else 'rotation'
        reasons = [
            f"Sessão {market_data['changePercent']:+.2f}% desde a abertura ({market_data['changePoints']:+d} pts)",
            f"Tendências: {' | '.join([f'{item['timeframe']} {item['trend']}' for item in trend_analysis])}",
            f"Volume recente em {volume_ratio:.2f}x da média intradiária",
            f"RSI {rsi:.1f} | faixa do dia em {range_position * 100:.0f}%",
            'Contexto completo alinhado para gatilho operacional' if confirmed_direction != 'WAIT' else 'Ainda sem alinhamento total para liberação operacional',
        ]
        confirmation_levels = {
            'buyAbove': _round(recent_breakout_high) if direction_candidate == 'BUY' else None,
            'sellBelow': _round(recent_breakout_low) if direction_candidate == 'SELL' else None,
        }
        invalidation_levels = {
            'buyBelow': _round(support) if direction_candidate == 'BUY' else None,
            'sellAbove': _round(resistance) if direction_candidate == 'SELL' else None,
        }
        assistant_payload = {
            'symbol': symbol.upper(),
            'regime': regime,
            'bias': bias,
            'summary': f"{confirmed_direction} | {confidence:.0f}% | regime {regime}",
            'reasoning': reasons,
            'eventRisks': event_risks,
            'confirmationLevels': confirmation_levels,
            'invalidationLevels': invalidation_levels,
            'newsRiskScore': min(len(event_risks) * 20, 100),
            'dataSource': 'mt5+ibovfinancials' if raw_sources.get('mt5Snapshot') else 'ibovfinancials',
        }
        ai_summary = self._ai_summary(symbol, {
            'marketData': market_data,
            'assistant': assistant_payload,
            'tradeSetup': trade_setup,
            'news': news_items[:5],
        })
        if ai_summary:
            assistant_payload['aiSummary'] = ai_summary

        return {
            'marketData': market_data,
            'intradayBars': intraday_bars,
            'hourlyBars': hourly_bars,
            'dailyBars': daily_bars,
            'trendAnalysis': trend_analysis,
            'dailyProfile': daily_profile,
            'tradeSignal': {
                'type': confirmed_direction,
                'confidence': confidence,
                'reason': reasons,
                'conditions': {
                    'priceMovement': moved_one_percent,
                    'breakoutConfirmed': breakout_confirmed,
                    'volumeAboveAverage': volume_above_average,
                    'alignmentMultiframe': alignment_multiframe,
                    'technicalAlignment': technical_alignment,
                },
                'timestamp': market_data['timestamp'],
            },
            'tradeSetup': trade_setup,
            'bias': bias,
            'support': support,
            'resistance': resistance,
            'rangePosition': range_position,
            'volumeRatio': volume_ratio,
            'rsi': rsi,
            'assistant': assistant_payload,
            'freshness': {
                'isFresh': is_fresh,
                'maxDataAgeMinutes': max_data_age_minutes,
                'lastBarTimestamp': last_bar_iso,
            },
            'news': news,
            'context': raw_sources,
            'disclaimer': 'Conteúdo informativo e educacional. Não constitui recomendação financeira.',
        }
