import { TradeOperation, TaxCalculation, TaxDeclaration } from '@/types/operations';

const BROKERAGE_FEE_RATE = 0.0001; // 0.01% de taxa de corretagem
const DAY_TRADE_IR_RATE = 0.20; // 20% para day trade
const SWING_TRADE_IR_RATE = 0.15; // 15% para swing trade
const SWING_TRADE_MIN_DAYS = 1; // Mínimo de dias para considerar swing trade

export class TaxCalculator {
  static calculateOperationTax(operation: TradeOperation): TaxCalculation {
    if (operation.status !== 'CLOSED' || !operation.exitPrice || !operation.exitDate) {
      throw new Error('Operação deve estar fechada com preço de saída');
    }

    const entryValue = operation.quantity * operation.entryPrice;
    const exitValue = operation.quantity * operation.exitPrice;
    const brokerageFee = (entryValue + exitValue) * BROKERAGE_FEE_RATE;
    
    const grossProfit = operation.type === 'BUY' 
      ? exitValue - entryValue 
      : entryValue - exitValue;

    const netProfit = grossProfit - brokerageFee;
    
    const daysHeld = Math.floor(
      (operation.exitDate.getTime() - operation.entryDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const isoDayTrade = daysHeld === 0;
    const operationType = isoDayTrade ? 'DAY_TRADE' : 'SWING_TRADE';
    const irRate = isoDayTrade ? DAY_TRADE_IR_RATE : SWING_TRADE_IR_RATE;
    
    const taxableIncome = Math.max(0, netProfit);
    const irTax = taxableIncome * irRate;

    return {
      operationId: operation.id,
      grossProfit,
      brokerageFee,
      netProfit,
      taxableIncome,
      irTax,
      irRate,
      daysHeld,
      operationType,
    };
  }

  static calculateMonthlyDeclaration(operations: TradeOperation[], year: number, month: number): TaxDeclaration {
    const closedOperations = operations.filter(
      op => op.status === 'CLOSED' && 
             op.exitDate && 
             op.exitDate.getFullYear() === year && 
             op.exitDate.getMonth() + 1 === month
    );

    let totalBuyValue = 0;
    let totalSellValue = 0;
    let totalGrossProfit = 0;
    let totalBrokerageFees = 0;
    let totalNetProfit = 0;
    let totalIRTax = 0;
    let dayTradeCount = 0;
    let dayTradeProfit = 0;
    let dayTradeTax = 0;
    let swingTradeCount = 0;
    let swingTradeProfit = 0;
    let swingTradeTax = 0;

    for (const operation of closedOperations) {
      const tax = this.calculateOperationTax(operation);
      
      const opValue = operation.quantity * operation.entryPrice;
      if (operation.type === 'BUY') {
        totalBuyValue += opValue;
      } else {
        totalSellValue += opValue;
      }

      totalGrossProfit += tax.grossProfit;
      totalBrokerageFees += tax.brokerageFee;
      totalNetProfit += tax.netProfit;
      totalIRTax += tax.irTax;

      if (tax.operationType === 'DAY_TRADE') {
        dayTradeCount++;
        dayTradeProfit += tax.netProfit;
        dayTradeTax += tax.irTax;
      } else {
        swingTradeCount++;
        swingTradeProfit += tax.netProfit;
        swingTradeTax += tax.irTax;
      }
    }

    return {
      year,
      month,
      totalOperations: closedOperations.length,
      totalBuyValue,
      totalSellValue,
      totalGrossProfit,
      totalBrokerageFees,
      totalNetProfit,
      totalIRTax,
      dayTradeOperations: dayTradeCount,
      dayTradeProfit,
      dayTradeTax,
      swingTradeOperations: swingTradeCount,
      swingTradeProfit,
      swingTradeTax,
      generatedAt: new Date(),
    };
  }

  static calculateAnnualDeclaration(operations: TradeOperation[], year: number): TaxDeclaration {
    const closedOperations = operations.filter(
      op => op.status === 'CLOSED' && 
             op.exitDate && 
             op.exitDate.getFullYear() === year
    );

    let totalBuyValue = 0;
    let totalSellValue = 0;
    let totalGrossProfit = 0;
    let totalBrokerageFees = 0;
    let totalNetProfit = 0;
    let totalIRTax = 0;
    let dayTradeCount = 0;
    let dayTradeProfit = 0;
    let dayTradeTax = 0;
    let swingTradeCount = 0;
    let swingTradeProfit = 0;
    let swingTradeTax = 0;

    for (const operation of closedOperations) {
      const tax = this.calculateOperationTax(operation);
      
      const opValue = operation.quantity * operation.entryPrice;
      if (operation.type === 'BUY') {
        totalBuyValue += opValue;
      } else {
        totalSellValue += opValue;
      }

      totalGrossProfit += tax.grossProfit;
      totalBrokerageFees += tax.brokerageFee;
      totalNetProfit += tax.netProfit;
      totalIRTax += tax.irTax;

      if (tax.operationType === 'DAY_TRADE') {
        dayTradeCount++;
        dayTradeProfit += tax.netProfit;
        dayTradeTax += tax.irTax;
      } else {
        swingTradeCount++;
        swingTradeProfit += tax.netProfit;
        swingTradeTax += tax.irTax;
      }
    }

    return {
      year,
      totalOperations: closedOperations.length,
      totalBuyValue,
      totalSellValue,
      totalGrossProfit,
      totalBrokerageFees,
      totalNetProfit,
      totalIRTax,
      dayTradeOperations: dayTradeCount,
      dayTradeProfit,
      dayTradeTax,
      swingTradeOperations: swingTradeCount,
      swingTradeProfit,
      swingTradeTax,
      generatedAt: new Date(),
    };
  }

  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  static formatPercent(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
  }
}
