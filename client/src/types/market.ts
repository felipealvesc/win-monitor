export interface MarketData {
  symbol: string;
  currentPrice: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  previousClose: number;
  timestamp: Date;
  changePercent: number;
  changePoints: number;
}

export interface HistoricalBar {
  timestamp: Date;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  returnPercent: number;
}

export interface TechnicalIndicators {
  vwap: number;
  sma20: number;
  sma50: number;
  rsi: number;
  macd: number;
  bollingerUpper: number;
  bollingerLower: number;
  bollingerMiddle: number;
}

export interface TrendAnalysis {
  timeframe: '5m' | '60m' | '1d';
  trend: 'uptrend' | 'downtrend' | 'sideways';
  strength: number;
  support: number;
  resistance: number;
}

export interface TimeframeTrend extends TrendAnalysis {
  price: number;
  sma9: number;
  sma21: number;
  sma50: number;
  slopePercent: number;
  momentumPercent: number;
}

export interface RiskCalculation {
  entryPrice: number;
  accountSize: number;
  riskPercentage: number;
  maxRiskAmount: number;
  stopLossPoints: number;
  stopLossPrice: number;
  takeProfitPoints: number;
  takeProfitPrice: number;
  riskRewardRatio: number;
  contractsAllowed: number;
}

export interface TradeSignal {
  type: 'BUY' | 'SELL' | 'WAIT';
  confidence: number;
  reason: string[];
  conditions: {
    priceMovement: boolean;
    breakoutConfirmed: boolean;
    volumeAboveAverage: boolean;
    alignmentMultiframe: boolean;
    technicalAlignment: boolean;
  };
  timestamp: Date;
}

export interface DailyReturnProfile {
  avgDailyReturn: number;
  avgPositiveReturn: number;
  avgNegativeReturn: number;
  avgDailyRange: number;
  typicalDailyMove: number;
  volatility: number;
  positiveCloseRate: number;
  last20AverageVolume: number;
}

export interface TradeSetup {
  direction: 'BUY' | 'SELL' | 'WAIT';
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  stopPoints: number;
  targetPoints: number;
  riskRewardRatio: number;
  maxRiskAmount: number;
  contractsAllowed: number;
  riskPercentage: number;
  support: number;
  resistance: number;
}

export interface MarketAnalysis {
  marketData: MarketData;
  intradayBars: HistoricalBar[];
  hourlyBars: HistoricalBar[];
  dailyBars: HistoricalBar[];
  trendAnalysis: TimeframeTrend[];
  dailyProfile: DailyReturnProfile;
  tradeSignal: TradeSignal;
  tradeSetup: TradeSetup;
  bias: 'bullish' | 'bearish' | 'neutral';
  support: number;
  resistance: number;
  rangePosition: number;
  volumeRatio: number;
  rsi: number;
}

export interface PortfolioMetrics {
  totalCapital: number;
  usedCapital: number;
  availableCapital: number;
  riskExposure: number;
  maxRiskAllowed: number;
  activePositions: number;
  profitLoss: number;
  profitLossPercent: number;
}

export interface AlertConfig {
  priceChangeThreshold: number;
  volumeThreshold: number;
  rsiOverbought: number;
  rsiOversold: number;
  enableNotifications: boolean;
}

export interface SimulationResult {
  marketData: MarketData;
  technicalIndicators: TechnicalIndicators;
  trendAnalysis: TrendAnalysis[];
  tradeSignal: TradeSignal;
  riskCalculation: RiskCalculation;
  portfolioMetrics: PortfolioMetrics;
}

export interface Mt5ExportFile {
  name: string;
  path: string;
  size: number;
  lastModified: string;
  location: 'terminal' | 'common';
}

export interface Mt5Status {
  terminalDetected: boolean;
  installPath: string | null;
  dataPath: string | null;
  terminalFilesPath: string | null;
  commonFilesPath: string | null;
  latestLogFile: string | null;
  build: string | null;
  broker: string | null;
  accountId: string | null;
  server: string | null;
  positions: number | null;
  orders: number | null;
  symbols: number | null;
  spreads: number | null;
  accountMode: 'netting' | 'hedging' | 'unknown';
  availableExports: Mt5ExportFile[];
  relevantDataPoints: string[];
  notes: string[];
  recentLogEntries: string[];
}
