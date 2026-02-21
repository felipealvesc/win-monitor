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
