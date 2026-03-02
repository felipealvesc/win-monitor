import { MarketData } from '@/types/market';

/**
 * Servico de dados do mercado consumindo a API interna (/api/market).
 * O backend consulta apenas o MT5 local via bridge Python.
 */
export class MarketDataService {
  private static readonly BASE_URL = '/api/market';

  static async fetchWINData(): Promise<MarketData | null> {
    return this.fetchQuote('WINJ26');
  }

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
      console.error(`Erro ao buscar dados MT5 de ${symbol}:`, error);
      return null;
    }
  }

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
      console.error('Erro ao buscar multiplos dados MT5:', error);
      return {};
    }
  }

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

      return await response.json();
    } catch (error) {
      console.error(`Erro ao buscar historico MT5 de ${symbol}:`, error);
      return null;
    }
  }

  static async getAvailableSymbols(): Promise<string[]> {
    try {
      const response = await fetch(`${this.BASE_URL}/symbols`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.symbols || [];
    } catch (error) {
      console.error('Erro ao buscar simbolos MT5 disponiveis:', error);
      return [];
    }
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
