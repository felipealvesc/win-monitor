import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';

export interface MarketDataResponse {
  symbol: string;
  currentPrice: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  previousClose: number;
  changePercent: number;
  changePoints: number;
  timestamp: string;
  currency: string;
  name?: string;
  bid?: number;
  ask?: number;
  last?: number;
}

type Interval = '1m' | '5m' | '15m' | '30m' | '60m' | '1d';
type Range = '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'ytd' | 'max';

const execFileAsync = promisify(execFile);
const PYTHON_BIN = process.env.PYTHON_BIN || 'python';
const MT5_BRIDGE_SCRIPT = path.resolve(process.cwd(), 'scripts', 'mt5_market_bridge.py');

const parseStdout = <T>(stdout: string): T => {
  return JSON.parse(stdout.trim()) as T;
};

const runBridge = async <T>(args: string[]): Promise<T> => {
  const { stdout, stderr } = await execFileAsync(PYTHON_BIN, [MT5_BRIDGE_SCRIPT, ...args], {
    timeout: 20000,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
  });

  if (stderr?.trim()) {
    console.warn('MT5 bridge stderr:', stderr.trim());
  }

  return parseStdout<T>(stdout);
};

export class Mt5MarketDataService {
  static async fetchQuote(symbol: string): Promise<MarketDataResponse | null> {
    try {
      const response = await runBridge<MarketDataResponse & { error?: string }>([
        'quote',
        symbol.toUpperCase(),
      ]);

      if (response.error) {
        console.error(`Erro MT5 quote ${symbol}:`, response.error);
        return null;
      }

      return response;
    } catch (error) {
      console.error(`Erro ao buscar quote MT5 de ${symbol}:`, error);
      return null;
    }
  }

  static async fetchMultipleQuotes(symbols: string[]): Promise<Record<string, MarketDataResponse | null>> {
    const results: Record<string, MarketDataResponse | null> = {};

    for (const symbol of symbols) {
      results[symbol] = await this.fetchQuote(symbol);
    }

    return results;
  }

  static async fetchHistoricalData(
    symbol: string,
    interval: Interval = '1d',
    range: Range = '1mo'
  ): Promise<any> {
    try {
      const response = await runBridge<any>([
        'historical',
        symbol.toUpperCase(),
        interval,
        range,
      ]);

      if (response?.error) {
        console.error(`Erro MT5 histórico ${symbol}:`, response.error);
        return null;
      }

      return response;
    } catch (error) {
      console.error(`Erro ao buscar histórico MT5 de ${symbol}:`, error);
      return null;
    }
  }

  static async getAvailableSymbols(): Promise<string[]> {
    try {
      const response = await runBridge<{ symbols?: string[]; error?: string }>(['symbols']);

      if (response.error) {
        console.error('Erro MT5 symbols:', response.error);
        return ['WINJ26'];
      }

      return response.symbols?.length ? response.symbols : ['WINJ26'];
    } catch (error) {
      console.error('Erro ao buscar símbolos MT5:', error);
      return ['WINJ26'];
    }
  }
}
