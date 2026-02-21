import axios from 'axios';

export interface YahooFinanceQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketOpen: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  regularMarketPreviousClose: number;
  currency: string;
  longName?: string;
  exchangeName?: string;
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

const YAHOO_QUOTE_API = process.env.YAHOO_QUOTE_API_URL || 'https://query2.finance.yahoo.com/v7/finance/quote';
const YAHOO_CHART_API = process.env.YAHOO_CHART_API_URL || 'https://query2.finance.yahoo.com/v8/finance/chart';
const YAHOO_REFERER = process.env.YAHOO_REFERER || 'https://finance.yahoo.com/';
const YAHOO_X_API_HOST = process.env.YAHOO_X_API_HOST;
const YAHOO_X_API_KEY = process.env.YAHOO_X_API_KEY;

// Mapeamento de símbolos para Yahoo Finance
const SYMBOL_MAP: Record<string, string> = {
  'WINJ26': '^BVSP',      // Mini Índice (usando Bovespa como proxy)
  'WIN': '^BVSP',         // Mini Índice
  'IBOV': '^BVSP',        // Bovespa
  'BVSP': '^BVSP',        // Bovespa
};

const buildYahooHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': YAHOO_REFERER,
  };

  if (YAHOO_X_API_HOST) {
    headers['x-api-host'] = YAHOO_X_API_HOST;
  }

  if (YAHOO_X_API_KEY) {
    headers['x-api-key'] = YAHOO_X_API_KEY;
  }

  return headers;
};

export class YahooFinanceService {
  private static async fetchQuoteFromChart(symbol: string): Promise<YahooFinanceQuote | null> {
    const response = await axios.get(`${YAHOO_CHART_API}/${encodeURIComponent(symbol)}`, {
      params: {
        interval: '1d',
        range: '5d',
      },
      timeout: 10000,
      headers: buildYahooHeaders(),
    });

    const result = response.data?.chart?.result?.[0];
    const meta = result?.meta;
    const quoteData = result?.indicators?.quote?.[0];

    if (!meta || !quoteData) {
      return null;
    }

    const firstValid = (values?: Array<number | null>): number => {
      if (!values || values.length === 0) {
        return 0;
      }

      for (let i = values.length - 1; i >= 0; i -= 1) {
        const value = values[i];
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }
      }

      return 0;
    };

    return {
      symbol: meta.symbol || symbol,
      regularMarketPrice: meta.regularMarketPrice || firstValid(quoteData.close),
      regularMarketOpen: firstValid(quoteData.open),
      regularMarketDayHigh: firstValid(quoteData.high),
      regularMarketDayLow: firstValid(quoteData.low),
      regularMarketVolume: firstValid(quoteData.volume),
      regularMarketPreviousClose: meta.previousClose || 0,
      currency: meta.currency || 'BRL',
      longName: meta.longName,
      exchangeName: meta.exchangeName,
    };
  }

  /**
   * Busca dados de um símbolo no Yahoo Finance
   */
  static async fetchQuote(symbol: string): Promise<MarketDataResponse | null> {
    try {
      const yahooSymbol = SYMBOL_MAP[symbol.toUpperCase()] || symbol;

      console.log(`Buscando dados de ${symbol} (${yahooSymbol}) no Yahoo Finance...`);

      let quote: YahooFinanceQuote | null = null;

      try {
        const response = await axios.get(YAHOO_QUOTE_API, {
          params: {
            symbols: yahooSymbol,
            lang: 'pt-BR',
            region: 'BR',
          },
          timeout: 10000,
          headers: buildYahooHeaders(),
        });

        if (response.data?.quoteResponse?.result?.length > 0) {
          quote = response.data.quoteResponse.result[0] as YahooFinanceQuote;
        }
      } catch (quoteError) {
        console.warn(`Falha no endpoint de quote para ${yahooSymbol}, tentando chart...`, quoteError instanceof Error ? quoteError.message : quoteError);
      }

      if (!quote) {
        quote = await this.fetchQuoteFromChart(yahooSymbol);
      }

      if (!quote) {
        console.warn(`Nenhum resultado encontrado para ${yahooSymbol}`);
        return null;
      }

      const currentPrice = quote.regularMarketPrice || 0;
      const dayOpen = quote.regularMarketOpen || 0;
      const previousClose = quote.regularMarketPreviousClose || 0;

      // Calcular variação percentual
      const changePercent = previousClose > 0
        ? Math.round(((currentPrice - previousClose) / previousClose) * 10000) / 100
        : 0;

      // Calcular variação em pontos (para mini índice, cada ponto = 0.20)
      const changePoints = dayOpen > 0
        ? Math.round((currentPrice - dayOpen) / 0.20)
        : 0;

      return {
        symbol: symbol.toUpperCase(),
        currentPrice,
        dayOpen,
        dayHigh: quote.regularMarketDayHigh || 0,
        dayLow: quote.regularMarketDayLow || 0,
        volume: quote.regularMarketVolume || 0,
        previousClose,
        changePercent,
        changePoints,
        timestamp: new Date().toISOString(),
        currency: quote.currency || 'BRL',
        name: quote.longName,
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
      const yahooSymbol = SYMBOL_MAP[symbol.toUpperCase()] || symbol;

      const response = await axios.get(`${YAHOO_CHART_API}/${encodeURIComponent(yahooSymbol)}`, {
        params: {
          interval,
          range,
          includePrePost: 'false',
          events: 'div,split',
          lang: 'pt-BR',
          region: 'BR',
        },
        timeout: 10000,
        headers: buildYahooHeaders(),
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
    return SYMBOL_MAP.hasOwnProperty(symbol.toUpperCase());
  }
}
