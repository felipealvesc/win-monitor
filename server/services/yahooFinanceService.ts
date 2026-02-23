import axios from 'axios';

export interface MassiveQuoteData {
  symbol: string;
  currentPrice: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  previousClose: number;
  currency: string;
  name?: string;
}

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
}

interface MassiveConfig {
  baseUrl: string;
  apiKey?: string;
}

const getMassiveConfig = (): MassiveConfig => ({
  baseUrl: process.env.MASSIVE_BASE_URL || 'https://api.massive.com',
  apiKey: process.env.MASSIVE_API_KEY,
});

// Mapeamento de símbolos para Massive (Polygon)
const SYMBOL_MAP: Record<string, string> = {
  WINJ26: 'I:IBOV', // Mini Índice (usando IBOV como proxy)
  WIN: 'I:IBOV',
  IBOV: 'I:IBOV',
  BVSP: 'I:IBOV',
};

const buildMassiveParams = (params: Record<string, string | number | boolean>) => {
  const config = getMassiveConfig();
  return {
    ...params,
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
  };
};

const toISOStringDate = (date: Date): string => date.toISOString().split('T')[0];

const getHistoricalWindow = (range: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'ytd' | 'max'): { from: string; to: string } => {
  const today = new Date();
  const from = new Date(today);

  switch (range) {
    case '1d':
      from.setDate(today.getDate() - 1);
      break;
    case '5d':
      from.setDate(today.getDate() - 5);
      break;
    case '1mo':
      from.setMonth(today.getMonth() - 1);
      break;
    case '3mo':
      from.setMonth(today.getMonth() - 3);
      break;
    case '6mo':
      from.setMonth(today.getMonth() - 6);
      break;
    case '1y':
      from.setFullYear(today.getFullYear() - 1);
      break;
    case '2y':
      from.setFullYear(today.getFullYear() - 2);
      break;
    case '5y':
      from.setFullYear(today.getFullYear() - 5);
      break;
    case '10y':
      from.setFullYear(today.getFullYear() - 10);
      break;
    case 'ytd':
      from.setMonth(0, 1);
      break;
    case 'max':
      from.setFullYear(today.getFullYear() - 20);
      break;
    default:
      from.setMonth(today.getMonth() - 1);
  }

  return {
    from: toISOStringDate(from),
    to: toISOStringDate(today),
  };
};

const getIntervalConfig = (interval: '1m' | '5m' | '15m' | '30m' | '60m' | '1d'): { multiplier: number; timespan: 'minute' | 'day' } => {
  switch (interval) {
    case '1m':
      return { multiplier: 1, timespan: 'minute' };
    case '5m':
      return { multiplier: 5, timespan: 'minute' };
    case '15m':
      return { multiplier: 15, timespan: 'minute' };
    case '30m':
      return { multiplier: 30, timespan: 'minute' };
    case '60m':
      return { multiplier: 60, timespan: 'minute' };
    case '1d':
    default:
      return { multiplier: 1, timespan: 'day' };
  }
};

export class YahooFinanceService {
  private static async fetchSnapshot(symbol: string): Promise<MassiveQuoteData | null> {
    const config = getMassiveConfig();

    const response = await axios.get(`${config.baseUrl}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(symbol)}`, {
      params: buildMassiveParams({}),
      timeout: 10000,
    });

    const ticker = response.data?.ticker;
    if (!ticker) {
      return null;
    }

    return {
      symbol,
      currentPrice: Number(ticker?.lastTrade?.p || ticker?.day?.c || 0),
      dayOpen: Number(ticker?.day?.o || 0),
      dayHigh: Number(ticker?.day?.h || 0),
      dayLow: Number(ticker?.day?.l || 0),
      volume: Number(ticker?.day?.v || 0),
      previousClose: Number(ticker?.prevDay?.c || 0),
      currency: 'USD',
      name: ticker?.ticker,
    };
  }

  private static async fetchPreviousAggregate(symbol: string): Promise<MassiveQuoteData | null> {
    const config = getMassiveConfig();

    const response = await axios.get(`${config.baseUrl}/v2/aggs/ticker/${encodeURIComponent(symbol)}/prev`, {
      params: buildMassiveParams({ adjusted: true }),
      timeout: 10000,
    });

    const result = response.data?.results?.[0];
    if (!result) {
      return null;
    }

    return {
      symbol,
      currentPrice: Number(result.c || 0),
      dayOpen: Number(result.o || 0),
      dayHigh: Number(result.h || 0),
      dayLow: Number(result.l || 0),
      volume: Number(result.v || 0),
      previousClose: Number(result.o || 0),
      currency: 'USD',
      name: symbol,
    };
  }

  /**
   * Busca dados de um símbolo via Massive API
   */
  static async fetchQuote(symbol: string): Promise<MarketDataResponse | null> {
    try {
      const massiveSymbol = SYMBOL_MAP[symbol.toUpperCase()] || symbol;

      console.log(`Buscando dados de ${symbol} (${massiveSymbol}) na Massive API...`);

      let quote = await this.fetchSnapshot(massiveSymbol);
      if (!quote) {
        quote = await this.fetchPreviousAggregate(massiveSymbol);
      }

      if (!quote) {
        console.warn(`Nenhum resultado encontrado para ${massiveSymbol}`);
        return null;
      }

      const currentPrice = quote.currentPrice || 0;
      const dayOpen = quote.dayOpen || 0;
      const previousClose = quote.previousClose || 0;

      const changePercent = previousClose > 0
        ? Math.round(((currentPrice - previousClose) / previousClose) * 10000) / 100
        : 0;

      const changePoints = dayOpen > 0
        ? Math.round((currentPrice - dayOpen) / 0.20)
        : 0;

      return {
        symbol: symbol.toUpperCase(),
        currentPrice,
        dayOpen,
        dayHigh: quote.dayHigh || 0,
        dayLow: quote.dayLow || 0,
        volume: quote.volume || 0,
        previousClose,
        changePercent,
        changePoints,
        timestamp: new Date().toISOString(),
        currency: quote.currency || 'USD',
        name: quote.name,
      };
    } catch (error) {
      console.error(`Erro ao buscar dados de ${symbol}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Busca dados de múltiplos símbolos
   */
  static async fetchMultipleQuotes(symbols: string[]): Promise<Record<string, MarketDataResponse | null>> {
    const results: Record<string, MarketDataResponse | null> = {};

    for (const symbol of symbols) {
      results[symbol] = await this.fetchQuote(symbol);
    }

    return results;
  }

  /**
   * Busca dados históricos de um símbolo
   */
  static async fetchHistoricalData(
    symbol: string,
    interval: '1m' | '5m' | '15m' | '30m' | '60m' | '1d' = '1d',
    range: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'ytd' | 'max' = '1mo'
  ): Promise<any> {
    try {
      const massiveSymbol = SYMBOL_MAP[symbol.toUpperCase()] || symbol;
      const config = getMassiveConfig();
      const { multiplier, timespan } = getIntervalConfig(interval);
      const { from, to } = getHistoricalWindow(range);

      const response = await axios.get(`${config.baseUrl}/v2/aggs/ticker/${encodeURIComponent(massiveSymbol)}/range/${multiplier}/${timespan}/${from}/${to}`, {
        params: buildMassiveParams({ adjusted: true, sort: 'asc', limit: 5000 }),
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      console.error(`Erro ao buscar dados históricos de ${symbol}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Retorna lista de símbolos mapeados
   */
  static getAvailableSymbols(): string[] {
    return Object.keys(SYMBOL_MAP);
  }

  /**
   * Valida se um símbolo é válido
   */
  static isValidSymbol(symbol: string): boolean {
    return Object.prototype.hasOwnProperty.call(SYMBOL_MAP, symbol.toUpperCase());
  }
}
