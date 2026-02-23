import axios from 'axios';

interface MassiveWebsocketStatusMessage {
  ev: 'status';
  status?: string;
  message?: string;
}

interface MassiveIndexValueMessage {
  ev: 'V';
  sym: string;
  val?: number;
  open?: number;
  high?: number;
  low?: number;
  prev?: number;
  t?: number;
}

type MassiveWsMessage = MassiveWebsocketStatusMessage | MassiveIndexValueMessage;

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
      change_percent?: number;
    };
    last_updated?: number;
    name?: string;
  }>;
}

interface MassiveAggregateResponse {
  ticker?: string;
  results?: Array<{
    o?: number;
    h?: number;
    l?: number;
    c?: number;
    v?: number;
    t?: number;
  }>;
}

interface MassiveConfig {
  restBaseUrl: string;
  wsUrl: string;
  apiKey?: string;
}

interface MassiveQuoteData {
  symbol: string;
  currentPrice: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  previousClose: number;
  currency: string;
  timestamp: string;
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

const getMassiveConfig = (): MassiveConfig => ({
  restBaseUrl: process.env.MASSIVE_REST_BASE_URL || 'https://api.massive.com',
  wsUrl: process.env.MASSIVE_WS_URL || 'wss://socket.massive.com/indices',
  apiKey: process.env.MASSIVE_API_KEY,
});

const SYMBOL_MAP: Record<string, string> = {
  WINJ26: 'I:IBOV',
  WIN: 'I:IBOV',
  IBOV: 'I:IBOV',
  BVSP: 'I:IBOV',
};

const fromMassiveSymbol = (massiveSymbol: string): string => {
  const alias = Object.entries(SYMBOL_MAP).find(([, mapped]) => mapped === massiveSymbol)?.[0];
  return alias || massiveSymbol;
};

const buildMassiveParams = (params: Record<string, string | number | boolean>) => {
  const { apiKey } = getMassiveConfig();
  return {
    ...params,
    ...(apiKey ? { apiKey } : {}),
  };
};

const toISODate = (date: Date): string => date.toISOString().split('T')[0];

const getHistoricalWindow = (range: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'ytd' | 'max') => {
  const today = new Date();
  const from = new Date(today);

  switch (range) {
    case '1d': from.setDate(from.getDate() - 1); break;
    case '5d': from.setDate(from.getDate() - 5); break;
    case '1mo': from.setMonth(from.getMonth() - 1); break;
    case '3mo': from.setMonth(from.getMonth() - 3); break;
    case '6mo': from.setMonth(from.getMonth() - 6); break;
    case '1y': from.setFullYear(from.getFullYear() - 1); break;
    case '2y': from.setFullYear(from.getFullYear() - 2); break;
    case '5y': from.setFullYear(from.getFullYear() - 5); break;
    case '10y': from.setFullYear(from.getFullYear() - 10); break;
    case 'ytd': from.setMonth(0, 1); break;
    case 'max': from.setFullYear(from.getFullYear() - 20); break;
    default: from.setMonth(from.getMonth() - 1);
  }

  return { from: toISODate(from), to: toISODate(today) };
};

const getIntervalConfig = (interval: '1m' | '5m' | '15m' | '30m' | '60m' | '1d') => {
  switch (interval) {
    case '1m': return { multiplier: 1, timespan: 'minute' as const };
    case '5m': return { multiplier: 5, timespan: 'minute' as const };
    case '15m': return { multiplier: 15, timespan: 'minute' as const };
    case '30m': return { multiplier: 30, timespan: 'minute' as const };
    case '60m': return { multiplier: 60, timespan: 'minute' as const };
    default: return { multiplier: 1, timespan: 'day' as const };
  }
};

export class YahooFinanceService {
  private static wsInitialized = false;
  private static wsReconnectTimer: NodeJS.Timeout | null = null;
  private static ws: WebSocket | null = null;
  private static realtimeCache = new Map<string, MassiveQuoteData>();

  private static ensureWebsocketConnection() {
    if (this.wsInitialized) {
      return;
    }

    this.wsInitialized = true;
    this.connectWebsocket();
  }

  private static connectWebsocket() {
    const { wsUrl, apiKey } = getMassiveConfig();
    if (!apiKey) {
      return;
    }

    try {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ action: 'auth', params: apiKey }));
        const subscriptions = Array.from(new Set(Object.values(SYMBOL_MAP))).map((symbol) => `V.${symbol}`);
        ws.send(JSON.stringify({ action: 'subscribe', params: subscriptions.join(',') }));
      });

      ws.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(String(event.data));
          const messages: MassiveWsMessage[] = Array.isArray(payload) ? payload : [payload];

          for (const message of messages) {
            if (message.ev !== 'V') {
              continue;
            }

            const previous = this.realtimeCache.get(message.sym);
            const currentPrice = Number(message.val ?? previous?.currentPrice ?? 0);
            const dayOpen = Number(message.open ?? previous?.dayOpen ?? 0);
            const dayHigh = Number(message.high ?? previous?.dayHigh ?? currentPrice);
            const dayLow = Number(message.low ?? previous?.dayLow ?? currentPrice);
            const previousClose = Number(message.prev ?? previous?.previousClose ?? 0);

            this.realtimeCache.set(message.sym, {
              symbol: message.sym,
              currentPrice,
              dayOpen,
              dayHigh,
              dayLow,
              volume: previous?.volume || 0,
              previousClose,
              currency: previous?.currency || 'BRL',
              name: previous?.name || fromMassiveSymbol(message.sym),
              timestamp: new Date(message.t || Date.now()).toISOString(),
            });
          }
        } catch (error) {
          console.warn('Erro ao processar mensagem websocket da Massive:', error);
        }
      });

      ws.addEventListener('close', () => this.scheduleReconnect());
      ws.addEventListener('error', () => this.scheduleReconnect());
    } catch (error) {
      console.warn('Não foi possível conectar ao websocket da Massive:', error);
      this.scheduleReconnect();
    }
  }

  private static scheduleReconnect() {
    if (this.wsReconnectTimer) {
      return;
    }

    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      this.connectWebsocket();
    }, 5000);
  }

  private static async fetchSnapshot(symbol: string): Promise<MassiveQuoteData | null> {
    const { restBaseUrl } = getMassiveConfig();
    const response = await axios.get<MassiveSnapshotResponse>(`${restBaseUrl}/v3/snapshot/indices`, {
      params: buildMassiveParams({ 'ticker.any_of': symbol }),
      timeout: 10000,
    });

    const result = response.data?.results?.[0];
    if (!result) {
      return null;
    }

    return {
      symbol: result.ticker || symbol,
      currentPrice: Number(result.value || result.session?.close || 0),
      dayOpen: Number(result.session?.open || 0),
      dayHigh: Number(result.session?.high || 0),
      dayLow: Number(result.session?.low || 0),
      volume: 0,
      previousClose: Number(result.session?.close || 0) - Number(result.session?.change || 0),
      currency: 'BRL',
      name: result.name,
      timestamp: new Date(result.last_updated || Date.now()).toISOString(),
    };
  }

  private static async fetchPreviousAggregate(symbol: string): Promise<MassiveQuoteData | null> {
    const { restBaseUrl } = getMassiveConfig();
    const response = await axios.get<MassiveAggregateResponse>(`${restBaseUrl}/v2/aggs/ticker/${encodeURIComponent(symbol)}/prev`, {
      params: buildMassiveParams({ adjusted: true }),
      timeout: 10000,
    });

    const row = response.data?.results?.[0];
    if (!row) {
      return null;
    }

    return {
      symbol,
      currentPrice: Number(row.c || 0),
      dayOpen: Number(row.o || 0),
      dayHigh: Number(row.h || 0),
      dayLow: Number(row.l || 0),
      volume: Number(row.v || 0),
      previousClose: Number(row.o || 0),
      currency: 'BRL',
      name: fromMassiveSymbol(symbol),
      timestamp: new Date(row.t || Date.now()).toISOString(),
    };
  }

  static async fetchQuote(symbol: string): Promise<MarketDataResponse | null> {
    try {
      this.ensureWebsocketConnection();

      const massiveSymbol = SYMBOL_MAP[symbol.toUpperCase()] || symbol;
      const realtime = this.realtimeCache.get(massiveSymbol);

      let quote: MassiveQuoteData | null = realtime ?? null;
      if (!quote) {
        quote = await this.fetchSnapshot(massiveSymbol);
      }
      if (!quote) {
        quote = await this.fetchPreviousAggregate(massiveSymbol);
      }
      if (!quote) {
        return null;
      }

      const previousClose = quote.previousClose || 0;
      const currentPrice = quote.currentPrice || 0;
      const dayOpen = quote.dayOpen || 0;

      return {
        symbol: symbol.toUpperCase(),
        currentPrice,
        dayOpen,
        dayHigh: quote.dayHigh || 0,
        dayLow: quote.dayLow || 0,
        volume: quote.volume || 0,
        previousClose,
        changePercent: previousClose > 0 ? Math.round((((currentPrice - previousClose) / previousClose) * 100) * 100) / 100 : 0,
        changePoints: dayOpen > 0 ? Math.round((currentPrice - dayOpen) / 0.2) : 0,
        timestamp: quote.timestamp,
        currency: quote.currency,
        name: quote.name,
      };
    } catch (error) {
      console.error(`Erro ao buscar dados de ${symbol}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  static async fetchMultipleQuotes(symbols: string[]): Promise<Record<string, MarketDataResponse | null>> {
    const entries = await Promise.all(symbols.map(async (symbol) => [symbol, await this.fetchQuote(symbol)] as const));
    return Object.fromEntries(entries);
  }

  static async fetchHistoricalData(
    symbol: string,
    interval: '1m' | '5m' | '15m' | '30m' | '60m' | '1d' = '1d',
    range: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'ytd' | 'max' = '1mo',
  ): Promise<MassiveAggregateResponse | null> {
    try {
      const massiveSymbol = SYMBOL_MAP[symbol.toUpperCase()] || symbol;
      const { multiplier, timespan } = getIntervalConfig(interval);
      const { from, to } = getHistoricalWindow(range);
      const { restBaseUrl } = getMassiveConfig();

      const response = await axios.get<MassiveAggregateResponse>(
        `${restBaseUrl}/v2/aggs/ticker/${encodeURIComponent(massiveSymbol)}/range/${multiplier}/${timespan}/${from}/${to}`,
        {
          params: buildMassiveParams({ adjusted: true, sort: 'asc', limit: 5000 }),
          timeout: 10000,
        },
      );

      return response.data;
    } catch (error) {
      console.error(`Erro ao buscar dados históricos de ${symbol}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  static getAvailableSymbols(): string[] {
    return Object.keys(SYMBOL_MAP);
  }

  static isValidSymbol(symbol: string): boolean {
    return Object.prototype.hasOwnProperty.call(SYMBOL_MAP, symbol.toUpperCase());
  }
}
