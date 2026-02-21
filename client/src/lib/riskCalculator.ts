import { RiskCalculation } from '@/types/market';

const POINT_VALUE = 0.20;
const MIN_CONTRACT_SIZE = 1;
const MAX_LEVERAGE = 20;

export class RiskCalculator {
  static calculateStopLevels(
    entryPrice: number,
    trend: 'uptrend' | 'downtrend' | 'sideways',
    support: number,
    resistance: number,
    volatility: number
  ) {
    let stopLoss: number;
    let takeProfit: number;

    if (trend === 'uptrend') {
      stopLoss = support - volatility * 0.005;
      takeProfit = entryPrice * 1.015;
    } else if (trend === 'downtrend') {
      stopLoss = resistance + volatility * 0.005;
      takeProfit = entryPrice * 0.985;
    } else {
      stopLoss = entryPrice * 0.995;
      takeProfit = entryPrice * 1.01;
    }

    const stopLossPoints = Math.abs((entryPrice - stopLoss) / POINT_VALUE);
    const takeProfitPoints = Math.abs((takeProfit - entryPrice) / POINT_VALUE);

    return {
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      stopLossPoints: Math.round(stopLossPoints),
      takeProfitPoints: Math.round(takeProfitPoints),
    };
  }

  static calculateMaxRisk(accountSize: number, riskPercentage: number = 1) {
    const maxRiskAmount = (accountSize * riskPercentage) / 100;
    return {
      maxRiskAmount: Math.round(maxRiskAmount * 100) / 100,
      maxRiskPercent: riskPercentage,
    };
  }

  static calculateContractSize(
    accountSize: number,
    stopLossPoints: number,
    riskPercentage: number = 1
  ): number {
    const maxRiskAmount = (accountSize * riskPercentage) / 100;
    const riskPerContract = stopLossPoints * POINT_VALUE;

    if (riskPerContract <= 0) return 0;

    const contracts = Math.floor(maxRiskAmount / riskPerContract);
    return Math.max(MIN_CONTRACT_SIZE, Math.min(contracts, MAX_LEVERAGE));
  }

  static calculateRiskRewardRatio(stopLossPoints: number, takeProfitPoints: number): number {
    if (stopLossPoints === 0) return 0;
    return Math.round((takeProfitPoints / stopLossPoints) * 100) / 100;
  }

  static calculateFullRisk(
    entryPrice: number,
    accountSize: number,
    stopLossPoints: number,
    takeProfitPoints: number,
    riskPercentage: number = 1
  ): RiskCalculation {
    const maxRisk = this.calculateMaxRisk(accountSize, riskPercentage);
    const contractsAllowed = this.calculateContractSize(
      accountSize,
      stopLossPoints,
      riskPercentage
    );
    const riskRewardRatio = this.calculateRiskRewardRatio(stopLossPoints, takeProfitPoints);

    return {
      entryPrice: Math.round(entryPrice * 100) / 100,
      accountSize: Math.round(accountSize * 100) / 100,
      riskPercentage,
      maxRiskAmount: maxRisk.maxRiskAmount,
      stopLossPoints,
      stopLossPrice: Math.round((entryPrice - stopLossPoints * POINT_VALUE) * 100) / 100,
      takeProfitPoints,
      takeProfitPrice: Math.round((entryPrice + takeProfitPoints * POINT_VALUE) * 100) / 100,
      riskRewardRatio,
      contractsAllowed,
    };
  }

  static validateRisk(risk: RiskCalculation, minRiskRewardRatio: number = 1.5) {
    const errors: string[] = [];

    if (risk.contractsAllowed < 1) {
      errors.push('Capital insuficiente para operar com o stop loss calculado');
    }

    if (risk.riskRewardRatio < minRiskRewardRatio) {
      errors.push(
        `Razao risco/recompensa (${risk.riskRewardRatio}) abaixo do minimo (${minRiskRewardRatio})`
      );
    }

    if (risk.stopLossPoints === 0) {
      errors.push('Stop loss nao pode ser zero');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static calculateDailyChangePercent(currentPrice: number, dayOpen: number): number {
    if (dayOpen === 0) return 0;
    return Math.round(((currentPrice - dayOpen) / dayOpen) * 10000) / 100;
  }

  static checkOnePercentThreshold(currentPrice: number, dayOpen: number): boolean {
    const changePercent = Math.abs(this.calculateDailyChangePercent(currentPrice, dayOpen));
    return changePercent >= 1;
  }

  static calculatePointsChange(currentPrice: number, dayOpen: number): number {
    return Math.round((currentPrice - dayOpen) / POINT_VALUE);
  }
}

