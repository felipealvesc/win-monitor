import { Mt5MarketDataService, MarketDataResponse } from './mt5MarketDataService';

type Trend = 'uptrend' | 'downtrend' | 'sideways';
type SignalType = 'BUY' | 'SELL' | 'WAIT';
type Interval = '5m' | '60m' | '1d';
type Range = '5d' | '1mo' | '6mo';

interface HistoricalBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface HistoricalResponse {
  results?: HistoricalBar[];
}

interface TimeframeSignal {
  timeframe: Interval;
  trend: Trend;
  strength: number;
  slopePercent: number;
  sma9: number;
  sma21: number;
  support: number;
  resistance: number;
}

export interface SignalEvaluation {
  symbol: string;
  signal: SignalType;
  confidence: number;
  currentPrice: number;
  changePercent: number;
  changePoints: number;
  volumeRatio: number;
  rsi: number;
  support: number;
  resistance: number;
  reasons: string[];
  trendAnalysis: TimeframeSignal[];
  timestamp: string;
  signature: string;
  isFresh: boolean;
  maxDataAgeMinutes: number;
}

const round = (value: number, precision = 2) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const average = (values: number[]) => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const normalizeBars = (response: HistoricalResponse | null): HistoricalBar[] => {
  return Array.isArray(response?.results) ? response.results : [];
};

const simpleMovingAverage = (values: number[], period: number) => {
  if (!values.length) {
    return 0;
  }

  const window = values.slice(-Math.min(values.length, period));
  return average(window);
};

const calculateRSI = (values: number[], period = 14) => {
  if (values.length < 2) {
    return 50;
  }

  const changes = values.slice(1).map((value, index) => value - values[index]);
  const window = changes.slice(-Math.min(changes.length, period));
  const gains = window.filter(change => change > 0);
  const losses = window.filter(change => change < 0).map(Math.abs);
  const averageGain = average(gains);
  const averageLoss = average(losses);

  if (averageLoss === 0) {
    return averageGain === 0 ? 50 : 100;
  }

  const relativeStrength = averageGain / averageLoss;
  return round(100 - 100 / (1 + relativeStrength));
};

const getSupport = (bars: HistoricalBar[], lookback = 20) => {
  const window = bars.slice(-Math.min(lookback, bars.length));
  if (!window.length) {
    return 0;
  }

  return Math.min(...window.map(bar => bar.l));
};

const getResistance = (bars: HistoricalBar[], lookback = 20) => {
  const window = bars.slice(-Math.min(lookback, bars.length));
  if (!window.length) {
    return 0;
  }

  return Math.max(...window.map(bar => bar.h));
};

const analyzeTimeframe = (bars: HistoricalBar[], timeframe: Interval): TimeframeSignal => {
  const closes = bars.map(bar => bar.c);
  const currentPrice = closes[closes.length - 1] || 0;
  const referenceIndex = Math.max(0, closes.length - 6);
  const referencePrice = closes[referenceIndex] || currentPrice;
  const sma9 = round(simpleMovingAverage(closes, 9));
  const sma21 = round(simpleMovingAverage(closes, 21));
  const slopePercent =
    referencePrice > 0 ? round(((currentPrice - referencePrice) / referencePrice) * 100) : 0;
  const support = round(getSupport(bars));
  const resistance = round(getResistance(bars));

  let trend: Trend = 'sideways';
  if (currentPrice >= sma9 && sma9 >= sma21 && slopePercent > 0) {
    trend = 'uptrend';
  } else if (currentPrice <= sma9 && sma9 <= sma21 && slopePercent < 0) {
    trend = 'downtrend';
  }

  const strength = round(
    clamp(Math.abs(slopePercent) * 12 + Math.abs((sma9 - sma21) / Math.max(currentPrice, 1)) * 2000, 0, 100)
  );

  return {
    timeframe,
    trend,
    strength,
    slopePercent,
    sma9,
    sma21,
    support,
    resistance,
  };
};

const buildSignature = (
  symbol: string,
  signal: SignalType,
  confidence: number,
  quoteTimestamp: string,
  lastBarTime: number
) => {
  return [
    symbol,
    signal,
    Math.floor(confidence),
    quoteTimestamp,
    lastBarTime,
  ].join(':');
};

export class MarketSignalService {
  static async evaluateSymbol(
    symbol: string,
    maxDataAgeMinutes: number = Number(process.env.SIGNAL_MAX_DATA_AGE_MINUTES || 90)
  ): Promise<SignalEvaluation | null> {
    const [quote, intradayResponse, hourlyResponse, dailyResponse] = await Promise.all([
      Mt5MarketDataService.fetchQuote(symbol),
      Mt5MarketDataService.fetchHistoricalData(symbol, '5m', '5d'),
      Mt5MarketDataService.fetchHistoricalData(symbol, '60m', '1mo'),
      Mt5MarketDataService.fetchHistoricalData(symbol, '1d', '6mo'),
    ]);

    if (!quote || !intradayResponse || !hourlyResponse || !dailyResponse) {
      return null;
    }

    return this.buildEvaluation(
      quote,
      intradayResponse as HistoricalResponse,
      hourlyResponse as HistoricalResponse,
      dailyResponse as HistoricalResponse,
      maxDataAgeMinutes
    );
  }

  static buildEvaluation(
    quote: MarketDataResponse,
    intradayResponse: HistoricalResponse,
    hourlyResponse: HistoricalResponse,
    dailyResponse: HistoricalResponse,
    maxDataAgeMinutes: number
  ): SignalEvaluation {
    const intradayBars = normalizeBars(intradayResponse);
    const hourlyBars = normalizeBars(hourlyResponse);
    const dailyBars = normalizeBars(dailyResponse);

    const trendAnalysis = [
      analyzeTimeframe(intradayBars, '5m'),
      analyzeTimeframe(hourlyBars, '60m'),
      analyzeTimeframe(dailyBars, '1d'),
    ];

    const intradayCloses = intradayBars.map(bar => bar.c);
    const hourlyCloses = hourlyBars.map(bar => bar.c);
    const dailyCloses = dailyBars.map(bar => bar.c);
    const bullishAlignment = trendAnalysis.every(item => item.trend === 'uptrend');
    const bearishAlignment = trendAnalysis.every(item => item.trend === 'downtrend');
    const alignmentMultiframe = bullishAlignment || bearishAlignment;
    const directionCandidate: SignalType = bullishAlignment
      ? 'BUY'
      : bearishAlignment
        ? 'SELL'
        : 'WAIT';

    const movedOnePercent = Math.abs(quote.changePercent) >= 1;
    const intradayWindow = intradayBars.slice(-20);
    const latestIntradayVolume = intradayWindow[intradayWindow.length - 1]?.v || 0;
    const volumeRatio = intradayWindow.length
      ? round(latestIntradayVolume / Math.max(average(intradayWindow.map(bar => bar.v)), 1))
      : 0;
    const volumeAboveAverage = volumeRatio >= 1.05;

    const support = round(
      Math.min(
        quote.dayLow || Number.POSITIVE_INFINITY,
        getSupport(intradayBars) || Number.POSITIVE_INFINITY,
        getSupport(hourlyBars) || Number.POSITIVE_INFINITY,
        getSupport(dailyBars) || Number.POSITIVE_INFINITY
      )
    );
    const resistance = round(
      Math.max(
        quote.dayHigh || 0,
        getResistance(intradayBars),
        getResistance(hourlyBars),
        getResistance(dailyBars)
      )
    );

    const sessionRange = quote.dayHigh - quote.dayLow;
    const rangePosition =
      sessionRange > 0 ? round((quote.currentPrice - quote.dayLow) / sessionRange, 4) : 0.5;
    const recentBreakoutHigh = getResistance(intradayBars.slice(0, -1), 12) || resistance;
    const recentBreakoutLow = getSupport(intradayBars.slice(0, -1), 12) || support;
    const breakoutConfirmed =
      directionCandidate === 'BUY'
        ? quote.currentPrice >= recentBreakoutHigh * 0.999 && rangePosition >= 0.7
        : directionCandidate === 'SELL'
          ? quote.currentPrice <= recentBreakoutLow * 1.001 && rangePosition <= 0.3
          : false;

    const rsi = calculateRSI(hourlyCloses.length ? hourlyCloses : dailyCloses);
    const dailySma20 = simpleMovingAverage(dailyCloses, 20);
    const technicalAlignment =
      directionCandidate === 'BUY'
        ? quote.currentPrice >= dailySma20 && rsi >= 55 && rsi <= 78
        : directionCandidate === 'SELL'
          ? quote.currentPrice <= dailySma20 && rsi <= 45 && rsi >= 22
          : false;

    const confirmedDirection =
      movedOnePercent &&
      alignmentMultiframe &&
      technicalAlignment &&
      breakoutConfirmed &&
      volumeAboveAverage
        ? directionCandidate
        : 'WAIT';

    const averageStrength = average(trendAnalysis.map(item => item.strength));
    const conditionsMatched = [
      movedOnePercent,
      alignmentMultiframe,
      technicalAlignment,
      breakoutConfirmed,
      volumeAboveAverage,
    ].filter(Boolean).length;
    const confidenceBase =
      conditionsMatched * 16 + averageStrength * 0.45 + Math.abs(quote.changePercent) * 8;
    const confidence =
      confirmedDirection === 'WAIT'
        ? clamp(confidenceBase * 0.75, 0, 79)
        : clamp(confidenceBase, 0, 100);

    const latestBarTime = intradayBars[intradayBars.length - 1]?.t || 0;
    const isFresh =
      latestBarTime > 0
        ? Date.now() - latestBarTime <= maxDataAgeMinutes * 60 * 1000
        : false;

    const reasons = [
      `Sessao ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}% (${quote.changePoints >= 0 ? '+' : ''}${quote.changePoints} pts)`,
      `Tendencias ${trendAnalysis.map(item => `${item.timeframe}:${item.trend}`).join(' | ')}`,
      `Volume ${volumeRatio.toFixed(2)}x da media intradiaria`,
      `RSI ${rsi.toFixed(1)} e fechamento ${quote.currentPrice.toFixed(0)}`,
      confirmedDirection === 'WAIT'
        ? 'Sem alinhamento total para envio operacional'
        : `Setup ${confirmedDirection} com breakout e filtros completos`,
    ];

    return {
      symbol: quote.symbol,
      signal: confirmedDirection,
      confidence: round(confidence),
      currentPrice: quote.currentPrice,
      changePercent: quote.changePercent,
      changePoints: quote.changePoints,
      volumeRatio,
      rsi,
      support,
      resistance,
      reasons,
      trendAnalysis,
      timestamp: quote.timestamp,
      signature: buildSignature(
        quote.symbol,
        confirmedDirection,
        confidence,
        quote.timestamp,
        latestBarTime
      ),
      isFresh,
      maxDataAgeMinutes,
    };
  }
}
