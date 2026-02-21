import { MarketData } from '@/types/market';

/**
 * Serviço de dados do mercado consumindo API interna (/api/market).
 * Evita chamadas diretas do browser ao Yahoo para não sofrer CORS.
 */
export class MarketDataService {
  private static readonly BASE_URL = '/api/market';

  /**
   * Busca dados do mini índice WIN
   */
  static async fetchWINData(): Promise<MarketData | null> {
    return this.fetchQuote('WINJ26');
  }

  /**
   * Busca dados de um símbolo específico
   */
  static async fetchQuote(symbol: string): Promise<MarketData | null> {
    try {
      const response = await fetch(`${this.BASE_URL}/quote/${symbol}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        ...data,
        timestamp: data?.timestamp ? new Date(data.timestamp) : new Date(),
      } as MarketData;
    } catch (error) {
      console.error(`Erro ao buscar dados de ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Busca dados de múltiplos símbolos
   */
  static async fetchMultipleSymbols(symbols: string[]): Promise<Record<string, MarketData | null>> {
    try {
      const symbolsParam = symbols.join(',');
      const response = await fetch(`${this.BASE_URL}/quotes?symbols=${encodeURIComponent(symbolsParam)}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const normalized: Record<string, MarketData | null> = {};

      for (const [symbol, value] of Object.entries(data)) {
        if (!value) {
          normalized[symbol] = null;
          continue;
        }

        const item = value as any;
        normalized[symbol] = {
          ...item,
          timestamp: item?.timestamp ? new Date(item.timestamp) : new Date(),
        } as MarketData;
      }

      return normalized;
    } catch (error) {
      console.error('Erro ao buscar múltiplos símbolos:', error);
      return {};
    }
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
      const response = await fetch(
        `${this.BASE_URL}/historical/${symbol}?interval=${interval}&range=${range}`
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Erro ao buscar dados históricos de ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Retorna lista de símbolos disponíveis
   */
  static async getAvailableSymbols(): Promise<string[]> {
    try {
      const response = await fetch(`${this.BASE_URL}/symbols`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.symbols || [];
    } catch (error) {
      console.error('Erro ao buscar símbolos disponíveis:', error);
      return [];
    }
  }

  /**
   * Formata valor em moeda brasileira
   */
  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  /**
   * Formata percentual
   */
  static formatPercent(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
  }
}
