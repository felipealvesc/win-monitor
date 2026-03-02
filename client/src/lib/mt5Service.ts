import { Mt5Status } from '@/types/market';

export class Mt5Service {
  private static readonly BASE_URL = '/api/mt5';

  static async fetchStatus(): Promise<Mt5Status | null> {
    try {
      const response = await fetch(`${this.BASE_URL}/status`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return (await response.json()) as Mt5Status;
    } catch (error) {
      console.error('Erro ao buscar status do MT5:', error);
      return null;
    }
  }
}
