import { MarketData } from '@/types/market';

interface MassiveSnapshotResponse {
  results?: Array<{
    ticker: string;
    value?: number;
    session?: {
      open?: number;
      high?: number;
      low?: number;
      close?: number;
      change?: number;
    };
    last_updated?: number;
    name?: string;
  }>;
}

interface MassiveAggregateResponse {
  results?: Array<{
    o?: number;
    h?: number;
    l?: number;
    c?: number;
    v?: number;
    t?: number;
  }>;
}

const MASSIVE_BASE_URL = import.meta.env.VITE_MASSIVE_REST_BASE_URL || 'https://api.massive.com';
const MASSIVE_API_KEY = import.meta.env.VITE_MASSIVE_API_KEY || '';

const SYMBOL_MAP: Record<string, string[]> = {
  WINJ26: ['I:IBOV', 'I:IBOVESPA', 'IBOV', '^BVSP'],
  WIN: ['I:IBOV', 'I:IBOVESPA', 'IBOV', '^BVSP'],
  IBOV: ['I:IBOV', 'I:IBOVESPA', 'IBOV', '^BVSP'],
  BVSP: ['I:IBOV', 'I:IBOVESPA', 'IBOV', '^BVSP'],
};

const getSymbolCandidates = (symbol: string): string[] => {
  const upper = symbol.toUpperCase();
  const mapped = SYMBOL_MAP[upper] || [upper];
  return Array.from(new Set(mapped));
};

const createMarketData = (symbol: string, payload: Partial<MarketData> & { currentPrice: number; dayOpen: number; previousClose: number }): MarketData => {
  const currentPrice = payload.currentPrice || 0;
  const dayOpen = payload.dayOpen || 0;
  const previousClose = payload.previousClose || 0;

  return {
    symbol: symbol.toUpperCase(),
    currentPrice,
    dayOpen,
    dayHigh: payload.dayHigh || currentPrice,
    dayLow: payload.dayLow || currentPrice,
    volume: payload.volume || 0,
    previousClose,
    changePercent: previousClose > 0 ? Math.round(((currentPrice - previousClose) / previousClose) * 10000) / 100 : 0,
    changePoints: dayOpen > 0 ? Math.round((currentPrice - dayOpen) / 0.2) : 0,
    timestamp: payload.timestamp || new Date(),
  };
};

const fetchSnapshot = async (candidate: string): Promise<MarketData | null> => {
  const url = new URL('/v3/snapshot/indices', MASSIVE_BASE_URL);
  url.searchParams.set('ticker.any_of', candidate);
  if (MASSIVE_API_KEY) {
    url.searchParams.set('apiKey', MASSIVE_API_KEY);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    return null;
  }

  const data = await response.json() as MassiveSnapshotResponse;
  const result = data?.results?.[0];
  if (!result) {
    return null;
  }

  const currentPrice = Number(result.value || result.session?.close || 0);
  const previousClose = Number(result.session?.close || 0) - Number(result.session?.change || 0);

  return createMarketData(candidate, {
    currentPrice,
    dayOpen: Number(result.session?.open || currentPrice),
    dayHigh: Number(result.session?.high || currentPrice),
    dayLow: Number(result.session?.low || currentPrice),
    previousClose,
    timestamp: new Date(result.last_updated || Date.now()),
  });
};

const fetchPreviousAgg = async (candidate: string): Promise<MarketData | null> => {
  const url = new URL(`/v2/aggs/ticker/${encodeURIComponent(candidate)}/prev`, MASSIVE_BASE_URL);
  url.searchParams.set('adjusted', 'true');
  if (MASSIVE_API_KEY) {
    url.searchParams.set('apiKey', MASSIVE_API_KEY);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    return null;
  }

  const data = await response.json() as MassiveAggregateResponse;
  const row = data?.results?.[0];
  if (!row) {
    return null;
  }

  return createMarketData(candidate, {
    currentPrice: Number(row.c || 0),
    dayOpen: Number(row.o || 0),
    dayHigh: Number(row.h || 0),
    dayLow: Number(row.l || 0),
    previousClose: Number(row.o || 0),
    volume: Number(row.v || 0),
    timestamp: new Date(row.t || Date.now()),
  });
};

export class MarketDataService {
  static async fetchWINData(): Promise<MarketData | null> {
    return this.fetchQuote('WINJ26');
  }

  static async fetchQuote(symbol: string): Promise<MarketData | null> {
    const candidates = getSymbolCandidates(symbol);

    for (const candidate of candidates) {
      try {
        const snapshot = await fetchSnapshot(candidate);
        if (snapshot) {
          return { ...snapshot, symbol: symbol.toUpperCase() };
        }
      } catch {
        // tenta próximo
      }

      try {
        const prevAgg = await fetchPreviousAgg(candidate);
        if (prevAgg) {
          return { ...prevAgg, symbol: symbol.toUpperCase() };
        }
      } catch {
        // tenta próximo
      }
    }

    return null;
  }

  static async fetchMultipleSymbols(symbols: string[]): Promise<Record<string, MarketData | null>> {
    const entries = await Promise.all(symbols.map(async (symbol) => [symbol, await this.fetchQuote(symbol)] as const));
    return Object.fromEntries(entries);
  }

  static async fetchHistoricalData(
    symbol: string,
    interval: '1m' | '5m' | '15m' | '30m' | '60m' | '1d' = '1d',
    range: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'ytd' | 'max' = '1mo',
  ): Promise<any> {
    const intervalMap = {
      '1m': { multiplier: 1, timespan: 'minute' },
      '5m': { multiplier: 5, timespan: 'minute' },
      '15m': { multiplier: 15, timespan: 'minute' },
      '30m': { multiplier: 30, timespan: 'minute' },
      '60m': { multiplier: 60, timespan: 'minute' },
      '1d': { multiplier: 1, timespan: 'day' },
    } as const;

    const now = new Date();
    const from = new Date(now);
    const monthRanges: Record<string, number> = { '1mo': 1, '3mo': 3, '6mo': 6 };
    const yearRanges: Record<string, number> = { '1y': 1, '2y': 2, '5y': 5, '10y': 10 };

    if (range === '1d') from.setDate(now.getDate() - 1);
    else if (range === '5d') from.setDate(now.getDate() - 5);
    else if (range === 'ytd') from.setMonth(0, 1);
    else if (range === 'max') from.setFullYear(now.getFullYear() - 20);
    else if (monthRanges[range]) from.setMonth(now.getMonth() - monthRanges[range]);
    else if (yearRanges[range]) from.setFullYear(now.getFullYear() - yearRanges[range]);

    const fromDate = from.toISOString().split('T')[0];
    const toDate = now.toISOString().split('T')[0];
    const intervalCfg = intervalMap[interval] || intervalMap['1d'];

    for (const candidate of getSymbolCandidates(symbol)) {
      const url = new URL(
        `/v2/aggs/ticker/${encodeURIComponent(candidate)}/range/${intervalCfg.multiplier}/${intervalCfg.timespan}/${fromDate}/${toDate}`,
        MASSIVE_BASE_URL,
      );

      url.searchParams.set('adjusted', 'true');
      url.searchParams.set('sort', 'asc');
      url.searchParams.set('limit', '5000');
      if (MASSIVE_API_KEY) {
        url.searchParams.set('apiKey', MASSIVE_API_KEY);
      }

      try {
        const response = await fetch(url.toString());
        if (!response.ok) {
          continue;
        }

        const data = await response.json();
        if (data?.results?.length) {
          return data;
        }
      } catch {
        // tenta próximo
      }
    }

    return null;
  }

  static async getAvailableSymbols(): Promise<string[]> {
    return Object.keys(SYMBOL_MAP);
  }
}
