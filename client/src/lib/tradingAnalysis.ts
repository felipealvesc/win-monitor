import { RiskCalculator } from '@/lib/riskCalculator';
import {
  DailyReturnProfile,
  HistoricalBar,
  MarketAnalysis,
  MarketData,
  TimeframeTrend,
  TradeSetup,
  TradeSignal,
} from '@/types/market';

const POINT_VALUE = 0.2;

interface HistoricalApiBar {
  c?: number;
  h?: number;
  l?: number;
  o?: number;
  t?: number;
  v?: number;
}

interface HistoricalApiResponse {
  results?: HistoricalApiBar[];
}

interface BuildMarketAnalysisParams {
  snapshot: MarketData;
  intradayResponse: HistoricalApiResponse | null;
  hourlyResponse: HistoricalApiResponse | null;
  dailyResponse: HistoricalApiResponse | null;
  accountSize: number;
  riskPercentage: number;
}

const round = (value: number, precision = 2) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const average = (values: number[]) => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const standardDeviation = (values: number[]) => {
  if (!values.length) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map(value => (value - mean) ** 2));
  return Math.sqrt(variance);
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const simpleMovingAverage = (values: number[], period: number) => {
  if (!values.length) {
    return 0;
  }

  const window = values.slice(-Math.min(period, values.length));
  return average(window);
};

const calculateRSI = (values: number[], period = 14) => {
  if (values.length < 2) {
    return 50;
  }

  const changes = values.slice(1).map((value, index) => value - values[index]);
  const window = changes.slice(-Math.min(period, changes.length));
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

  return Math.min(...window.map(bar => bar.low));
};

const getResistance = (bars: HistoricalBar[], lookback = 20) => {
  const window = bars.slice(-Math.min(lookback, bars.length));
  if (!window.length) {
    return 0;
  }

  return Math.max(...window.map(bar => bar.high));
};

const formatLabel = (timestamp: Date, mode: 'intraday' | 'daily') => {
  if (mode === 'intraday') {
    return timestamp.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return timestamp.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
};

export const normalizeHistoricalData = (
  payload: HistoricalApiResponse | null,
  mode: 'intraday' | 'daily'
): HistoricalBar[] => {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  let previousClose = 0;

  return results.map(result => {
    const timestamp = new Date(result.t || Date.now());
    const close = Number(result.c || 0);
    const bar: HistoricalBar = {
      timestamp,
      label: formatLabel(timestamp, mode),
      open: Number(result.o || 0),
      high: Number(result.h || 0),
      low: Number(result.l || 0),
      close,
      volume: Number(result.v || 0),
      returnPercent:
        previousClose > 0 ? round(((close - previousClose) / previousClose) * 100) : 0,
    };

    previousClose = close;
    return bar;
  });
};

const analyzeTimeframe = (
  bars: HistoricalBar[],
  timeframe: '5m' | '60m' | '1d'
): TimeframeTrend => {
  const closes = bars.map(bar => bar.close);
  const currentPrice = closes[closes.length - 1] || 0;
  const referenceIndex = Math.max(0, closes.length - 6);
  const momentumIndex = Math.max(0, closes.length - 3);
  const referencePrice = closes[referenceIndex] || currentPrice;
  const momentumReference = closes[momentumIndex] || currentPrice;
  const sma9 = round(simpleMovingAverage(closes, 9));
  const sma21 = round(simpleMovingAverage(closes, 21));
  const sma50 = round(simpleMovingAverage(closes, 50));
  const slopePercent =
    referencePrice > 0 ? round(((currentPrice - referencePrice) / referencePrice) * 100) : 0;
  const momentumPercent =
    momentumReference > 0
      ? round(((currentPrice - momentumReference) / momentumReference) * 100)
      : 0;
  const support = round(getSupport(bars, 20));
  const resistance = round(getResistance(bars, 20));

  let trend: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';

  if (currentPrice >= sma9 && sma9 >= sma21 && slopePercent > 0) {
    trend = 'uptrend';
  } else if (currentPrice <= sma9 && sma9 <= sma21 && slopePercent < 0) {
    trend = 'downtrend';
  }

  const distanceScore = currentPrice > 0 ? Math.abs((sma9 - sma21) / currentPrice) * 2000 : 0;
  const strength = round(clamp(Math.abs(slopePercent) * 12 + Math.abs(momentumPercent) * 8 + distanceScore, 0, 100));

  return {
    timeframe,
    trend,
    strength,
    support,
    resistance,
    price: round(currentPrice),
    sma9,
    sma21,
    sma50,
    slopePercent,
    momentumPercent,
  };
};

const buildDailyProfile = (bars: HistoricalBar[]): DailyReturnProfile => {
  const returns = bars.slice(1).map(bar => bar.returnPercent);
  const positiveReturns = returns.filter(value => value > 0);
  const negativeReturns = returns.filter(value => value < 0);
  const rangePercents = bars
    .map(bar => (bar.open > 0 ? ((bar.high - bar.low) / bar.open) * 100 : 0))
    .filter(value => Number.isFinite(value));
  const last20Volume = bars.slice(-20).map(bar => bar.volume);

  return {
    avgDailyReturn: round(average(returns)),
    avgPositiveReturn: round(average(positiveReturns)),
    avgNegativeReturn: round(average(negativeReturns)),
    avgDailyRange: round(average(rangePercents)),
    typicalDailyMove: round(average(returns.map(value => Math.abs(value)))),
    volatility: round(standardDeviation(returns)),
    positiveCloseRate: round((positiveReturns.length / Math.max(returns.length, 1)) * 100),
    last20AverageVolume: round(average(last20Volume), 0),
  };
};

const inferBias = (trends: TimeframeTrend[]) => {
  const bullish = trends.filter(trend => trend.trend === 'uptrend').length;
  const bearish = trends.filter(trend => trend.trend === 'downtrend').length;

  if (bullish > bearish) {
    return 'bullish' as const;
  }

  if (bearish > bullish) {
    return 'bearish' as const;
  }

  return 'neutral' as const;
};

const buildTradeSetup = (
  snapshot: MarketData,
  direction: 'BUY' | 'SELL' | 'WAIT',
  bias: 'bullish' | 'bearish' | 'neutral',
  accountSize: number,
  riskPercentage: number,
  support: number,
  resistance: number,
  profile: DailyReturnProfile
): TradeSetup => {
  const setupDirection =
    direction !== 'WAIT'
      ? direction
      : bias === 'bullish'
        ? 'BUY'
        : bias === 'bearish'
          ? 'SELL'
          : 'WAIT';
  const entryPrice = round(snapshot.currentPrice);
  const movementPercent = Math.max(profile.typicalDailyMove, 0.7);
  const defaultDistance = Math.max(entryPrice * (movementPercent / 100) * 0.55, POINT_VALUE * 30);

  let stopPrice = entryPrice;
  let targetPrice = entryPrice;
  let stopPoints = 0;
  let targetPoints = 0;

  if (setupDirection === 'BUY') {
    const candidateStop = Math.min(
      support || entryPrice - defaultDistance,
      snapshot.dayLow || entryPrice - defaultDistance
    );
    stopPrice = round(candidateStop < entryPrice ? candidateStop : entryPrice - defaultDistance);
    stopPoints = Math.max(10, Math.round((entryPrice - stopPrice) / POINT_VALUE));
    targetPoints = Math.max(
      Math.round(stopPoints * 1.8),
      Math.round(((movementPercent / 100) * entryPrice) / POINT_VALUE)
    );
    targetPrice = round(entryPrice + targetPoints * POINT_VALUE);
  } else if (setupDirection === 'SELL') {
    const candidateStop = Math.max(
      resistance || entryPrice + defaultDistance,
      snapshot.dayHigh || entryPrice + defaultDistance
    );
    stopPrice = round(candidateStop > entryPrice ? candidateStop : entryPrice + defaultDistance);
    stopPoints = Math.max(10, Math.round((stopPrice - entryPrice) / POINT_VALUE));
    targetPoints = Math.max(
      Math.round(stopPoints * 1.8),
      Math.round(((movementPercent / 100) * entryPrice) / POINT_VALUE)
    );
    targetPrice = round(entryPrice - targetPoints * POINT_VALUE);
  }

  const maxRiskAmount = RiskCalculator.calculateMaxRisk(accountSize, riskPercentage).maxRiskAmount;
  const contractsAllowed =
    setupDirection === 'WAIT'
      ? 0
      : RiskCalculator.calculateContractSize(accountSize, stopPoints, riskPercentage);
  const riskRewardRatio =
    setupDirection === 'WAIT'
      ? 0
      : RiskCalculator.calculateRiskRewardRatio(stopPoints, targetPoints);

  return {
    direction: setupDirection,
    entryPrice,
    stopPrice,
    targetPrice,
    stopPoints,
    targetPoints,
    riskRewardRatio,
    maxRiskAmount,
    contractsAllowed,
    riskPercentage,
    support: round(support),
    resistance: round(resistance),
  };
};

export const buildMarketAnalysis = ({
  snapshot,
  intradayResponse,
  hourlyResponse,
  dailyResponse,
  accountSize,
  riskPercentage,
}: BuildMarketAnalysisParams): MarketAnalysis => {
  const intradayBars = normalizeHistoricalData(intradayResponse, 'intraday');
  const hourlyBars = normalizeHistoricalData(hourlyResponse, 'intraday');
  const dailyBars = normalizeHistoricalData(dailyResponse, 'daily');

  const trendAnalysis: TimeframeTrend[] = [
    analyzeTimeframe(intradayBars, '5m'),
    analyzeTimeframe(hourlyBars, '60m'),
    analyzeTimeframe(dailyBars, '1d'),
  ];

  const supportCandidates = [
    snapshot.dayLow,
    getSupport(intradayBars, 20),
    getSupport(hourlyBars, 20),
    getSupport(dailyBars, 20),
  ].filter(level => level > 0);
  const resistanceCandidates = [
    snapshot.dayHigh,
    getResistance(intradayBars, 20),
    getResistance(hourlyBars, 20),
    getResistance(dailyBars, 20),
  ].filter(level => level > 0);

  const support = round(Math.min(...supportCandidates));
  const resistance = round(Math.max(...resistanceCandidates));
  const dailyProfile = buildDailyProfile(dailyBars);
  const bias = inferBias(trendAnalysis);
  const sessionChangePercent = RiskCalculator.calculateDailyChangePercent(
    snapshot.currentPrice,
    snapshot.dayOpen
  );
  const movedOnePercent = Math.abs(sessionChangePercent) >= 1;
  const bullishAlignment = trendAnalysis.every(item => item.trend === 'uptrend');
  const bearishAlignment = trendAnalysis.every(item => item.trend === 'downtrend');
  const alignmentMultiframe = bullishAlignment || bearishAlignment;
  const directionCandidate: 'BUY' | 'SELL' | 'WAIT' = bullishAlignment
    ? 'BUY'
    : bearishAlignment
      ? 'SELL'
      : 'WAIT';
  const intradayWindow = intradayBars.slice(-20);
  const latestIntradayVolume = intradayWindow[intradayWindow.length - 1]?.volume || 0;
  const intradayAverageVolume = average(intradayWindow.map(bar => bar.volume));
  const volumeRatio =
    intradayAverageVolume > 0 ? round(latestIntradayVolume / intradayAverageVolume) : 0;
  const volumeAboveAverage = volumeRatio >= 1.05;
  const sessionRange = snapshot.dayHigh - snapshot.dayLow;
  const rangePosition =
    sessionRange > 0 ? round((snapshot.currentPrice - snapshot.dayLow) / sessionRange, 4) : 0.5;
  const recentBreakoutHigh = getResistance(intradayBars.slice(0, -1), 12) || resistance;
  const recentBreakoutLow = getSupport(intradayBars.slice(0, -1), 12) || support;
  const breakoutConfirmed =
    directionCandidate === 'BUY'
      ? snapshot.currentPrice >= recentBreakoutHigh * 0.999 && rangePosition >= 0.7
      : directionCandidate === 'SELL'
        ? snapshot.currentPrice <= recentBreakoutLow * 1.001 && rangePosition <= 0.3
        : false;
  const dailyCloses = dailyBars.map(bar => bar.close);
  const rsi = calculateRSI(hourlyBars.map(bar => bar.close).length ? hourlyBars.map(bar => bar.close) : dailyCloses);
  const dailySma20 = simpleMovingAverage(dailyCloses, 20);
  const technicalAlignment =
    directionCandidate === 'BUY'
      ? snapshot.currentPrice >= dailySma20 && rsi >= 55 && rsi <= 78
      : directionCandidate === 'SELL'
        ? snapshot.currentPrice <= dailySma20 && rsi <= 45 && rsi >= 22
        : false;

  const confirmedDirection =
    movedOnePercent &&
    alignmentMultiframe &&
    technicalAlignment &&
    breakoutConfirmed &&
    volumeAboveAverage
      ? directionCandidate
      : 'WAIT';

  const tradeSetup = buildTradeSetup(
    snapshot,
    confirmedDirection,
    bias,
    accountSize,
    riskPercentage,
    support,
    resistance,
    dailyProfile
  );

  const averageStrength = average(trendAnalysis.map(item => item.strength));
  const conditionsMatched = [
    movedOnePercent,
    alignmentMultiframe,
    technicalAlignment,
    breakoutConfirmed,
    volumeAboveAverage,
  ].filter(Boolean).length;
  const confidenceBase =
    conditionsMatched * 16 + averageStrength * 0.45 + Math.abs(sessionChangePercent) * 8;
  const confidence =
    confirmedDirection === 'WAIT'
      ? clamp(confidenceBase * 0.75, 0, 79)
      : clamp(confidenceBase, 0, 100);

  const tradeSignal: TradeSignal = {
    type: confirmedDirection,
    confidence: round(confidence),
    reason: [
      `Sessao em ${sessionChangePercent >= 0 ? '+' : ''}${sessionChangePercent.toFixed(2)}% desde a abertura`,
      `Tendencias: ${trendAnalysis
        .map(item => `${item.timeframe} ${item.trend.replace('trend', '')}`)
        .join(' | ')}`,
      `Retorno medio diario ${dailyProfile.avgDailyReturn.toFixed(2)}% com movimento tipico de ${dailyProfile.typicalDailyMove.toFixed(2)}%`,
      `Volume recente em ${volumeRatio.toFixed(2)}x da media intradiaria`,
      tradeSetup.direction === 'WAIT'
        ? 'Sem setup valido: aguarde alinhamento total dos filtros'
        : `Plano ${tradeSetup.direction}: stop ${tradeSetup.stopPoints} pts, alvo ${tradeSetup.targetPoints} pts, RR 1:${tradeSetup.riskRewardRatio.toFixed(2)}`,
    ],
    conditions: {
      priceMovement: movedOnePercent,
      breakoutConfirmed,
      volumeAboveAverage,
      alignmentMultiframe,
      technicalAlignment,
    },
    timestamp: new Date(),
  };

  return {
    marketData: snapshot,
    intradayBars,
    hourlyBars,
    dailyBars,
    trendAnalysis,
    dailyProfile,
    tradeSignal,
    tradeSetup,
    bias,
    support,
    resistance,
    rangePosition,
    volumeRatio,
    rsi,
  };
};
