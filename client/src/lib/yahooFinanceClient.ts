import { MarketData } from '@/types/market';

/**
 * Cliente RapidAPI Yahoo Finance para o frontend
 * Usa credenciais de RapidAPI para acesso à API do Yahoo Finance
 */

const RAPIDAPI_HOST = 'https://finance.yahoo.com';
const RAPIDAPI_KEY = '3c2f76c35emsh79f7cdfd30562c6p145ea6jsn29d4e7993eac';
const RAPIDAPI_BASE_URL = 'https://query2.finance.yahoo.com/v1/finance';

// Mapeamento de símbolos para Yahoo Finance
const SYMBOL_MAP: Record<string, string> = {
  'WINJ26': '^BVSP',      // Mini Índice (usando Bovespa como proxy)
  'WIN': '^BVSP',         // Mini Índice
  'IBOV': '^BVSP',        // Bovespa
  'BVSP': '^BVSP',        // Bovespa
};

const RAPIDAPI_HEADERS = {
  'x-rapidapi-host': RAPIDAPI_HOST,
  'x-rapidapi-key': RAPIDAPI_KEY,
};

interface YahooQuoteResponse {
  body: Array<{
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
  }>;
}

export class YahooFinanceClient {
  /**
   * Busca dados de um símbolo no Yahoo Finance via RapidAPI
   */
  static async fetchQuote(symbol: string): Promise<MarketData | null> {
    try {
      const yahooSymbol = '?&symbols=^BVSP';
      
      console.log(`Buscando dados de ${symbol} (${yahooSymbol}) no Yahoo Finance...`);

      const url = `${RAPIDAPI_BASE_URL}/api/v1/finance/quoteType/?symbol=PETR4.SA&lang=en-US&region=US&enablePrivateCompany=true`;

      const response = await fetch(url, {
        method: 'GET',
        headers: RAPIDAPI_HEADERS,
      });

      if (!response.ok) {
        console.warn(`Erro ao buscar dados: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error('Erro detalhado:', errorText);
        return null;
      }

      const data = (await response.json()) as YahooQuoteResponse;

      if (!data.body || data.body.length === 0) {
        console.warn(`Nenhum resultado encontrado para ${yahooSymbol}`);
        return null;
      }

      const quote = data.body[0];

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
        timestamp: new Date(),
      };
    } catch (error) {
      console.error(`Erro ao buscar dados de ${symbol}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Busca dados de múltiplos símbolos
   */
  static async fetchMultipleQuotes(symbols: string[]): Promise<Record<string, MarketData | null>> {
    const results: Record<string, MarketData | null> = {};

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
    interval: string = '1d',
    range: string = '1mo'
  ): Promise<any> {
    try {
      const yahooSymbol = SYMBOL_MAP[symbol.toUpperCase()] || symbol;

      const url = `${RAPIDAPI_BASE_URL}/api/v1/finance/historical/${yahooSymbol}?interval=${interval}&range=${range}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: RAPIDAPI_HEADERS,
      });

      if (!response.ok) {
        console.warn(`Erro ao buscar dados históricos: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return data;
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

  /**
   * Retorna informações sobre as credenciais
   */
  static getCredentialsInfo(): { host: string; keyPrefix: string } {
    return {
      host: RAPIDAPI_HOST,
      keyPrefix: RAPIDAPI_KEY.substring(0, 10) + '...',
    };
  }
}
