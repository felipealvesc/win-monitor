import { MarketData } from '@/types/market';
import { YahooFinanceClient } from './yahooFinanceClient';

/**
 * Serviço de dados do mercado que chama Yahoo Finance API diretamente
 */
export class MarketDataService {
  private static readonly BASE_URL = '/api/market';

  /**
   * Busca dados do mini índice WIN
   */
  static async fetchWINData(): Promise<MarketData | null> {
    return YahooFinanceClient.fetchQuote('WINJ26');
  }

  /**
   * Busca dados de um síbolo específ ico
   */
  static async fetchQuote(symbol: string): Promise<MarketData | null> {
    return YahooFinanceClient.fetchQuote(symbol);
  }

  /**
   * Busca dados de múltiplos síbmbolos
   */
  static async fetchMultipleSymbols(symbols: string[]): Promise<Record<string, MarketData | null>> {
    return YahooFinanceClient.fetchMultipleQuotes(symbols);
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
