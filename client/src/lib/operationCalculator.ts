import { TradeOperation } from '@/types/operations';

interface ContractSpec {
  financialMultiplier: number;
  pricePrecision: number;
}

const DEFAULT_CONTRACT_SPEC: ContractSpec = {
  financialMultiplier: 1,
  pricePrecision: 2,
};

const WIN_CONTRACT_SPEC: ContractSpec = {
  financialMultiplier: 200,
  pricePrecision: 3,
};

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function getContractSpec(symbol: string): ContractSpec {
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (normalizedSymbol.startsWith('WIN') || normalizedSymbol.startsWith('IND')) {
    return WIN_CONTRACT_SPEC;
  }

  return DEFAULT_CONTRACT_SPEC;
}

export function formatOperationPrice(value: number | null | undefined, symbol: string): string {
  if (value == null || !Number.isFinite(value)) {
    return '--';
  }

  const { pricePrecision } = getContractSpec(symbol);

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: pricePrecision,
    maximumFractionDigits: pricePrecision,
  }).format(value);
}

export function getPriceInputStep(symbol: string): string {
  const { pricePrecision } = getContractSpec(symbol);
  return (1 / 10 ** pricePrecision).toFixed(pricePrecision);
}

export function calculateOperationAmounts(
  operation: Pick<TradeOperation, 'type' | 'symbol' | 'quantity' | 'entryPrice' | 'exitPrice' | 'brokerageFee'>
) {
  const contractSpec = getContractSpec(operation.symbol);
  const entryValue = roundCurrency(operation.quantity * operation.entryPrice * contractSpec.financialMultiplier);
  const exitPrice = operation.exitPrice ?? 0;
  const exitValue = roundCurrency(operation.quantity * exitPrice * contractSpec.financialMultiplier);
  const grossProfit = roundCurrency(
    operation.type === 'BUY' ? exitValue - entryValue : entryValue - exitValue
  );
  const brokerageFee = roundCurrency(operation.brokerageFee || 0);
  const netProfit = roundCurrency(grossProfit - brokerageFee);

  return {
    contractSpec,
    entryValue,
    exitValue,
    grossProfit,
    brokerageFee,
    netProfit,
  };
}
