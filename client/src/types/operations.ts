export interface TradeOperation {
  id: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  entryDate: Date;
  exitDate?: Date;
  brokerageFee: number;
  notes?: string;
  status: 'OPEN' | 'CLOSED';
}

export interface TaxCalculation {
  operationId: string;
  grossProfit: number;
  brokerageFee: number;
  netProfit: number;
  taxableIncome: number;
  irTax: number; // Imposto de Renda
  irRate: number; // Alíquota do IR
  daysHeld: number;
  operationType: 'DAY_TRADE' | 'SWING_TRADE';
}

export interface TaxDeclaration {
  year: number;
  month?: number;
  totalOperations: number;
  totalBuyValue: number;
  totalSellValue: number;
  totalGrossProfit: number;
  totalBrokerageFees: number;
  totalNetProfit: number;
  totalIRTax: number;
  dayTradeOperations: number;
  dayTradeProfit: number;
  dayTradeTax: number;
  swingTradeOperations: number;
  swingTradeProfit: number;
  swingTradeTax: number;
  generatedAt: Date;
}

export interface PortfolioPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  totalCost: number;
  currentValue: number;
  unrealizedProfit: number;
  unrealizedProfitPercent: number;
  lastUpdate: Date;
}
