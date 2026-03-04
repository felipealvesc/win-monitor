import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { RiskCalculator } from '@/lib/riskCalculator';
import { MarketDataService } from '@/lib/marketDataService';
import { TaxCalculator } from '@/lib/taxCalculator';
import { MarketData, RiskCalculation, TradeSignal } from '@/types/market';
import { TradeOperation, TaxDeclaration } from '@/types/operations';
import OperationsForm from '@/components/OperationsForm';
import TaxDeclarationReport from '@/components/TaxDeclarationReport';

export default function Home() {
  const MIN_REVERSAL_POINTS = 4000;
  const [accountSize, setAccountSize] = useState(10000);
  const [currentPrice, setCurrentPrice] = useState(125000);
  const [dayOpen, setDayOpen] = useState(124000);
  const [dayHigh, setDayHigh] = useState(125500);
  const [dayLow, setDayLow] = useState(123800);
  const [riskCalculation, setRiskCalculation] = useState<RiskCalculation | null>(null);
  const [tradeSignal, setTradeSignal] = useState<TradeSignal | null>(null);
  const [loading, setLoading] = useState(false);
  const [operations, setOperations] = useState<TradeOperation[]>([]);
  const [taxDeclaration, setTaxDeclaration] = useState<TaxDeclaration | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'simulator' | 'operations' | 'taxes'>('simulator');
  const previousPriceRef = useRef(currentPrice);

  const fetchMarketData = async () => {
    setLoading(true);
    try {
      const data = await MarketDataService.fetchWINData();
      if (data) {
        setCurrentPrice(data.currentPrice);
        setDayOpen(data.dayOpen);
        setDayHigh(data.dayHigh);
        setDayLow(data.dayLow);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRisk = () => {
    const previousPrice = previousPriceRef.current;
    const dailyChange = RiskCalculator.calculateDailyChangePercent(currentPrice, dayOpen);
    const openToLowPoints = dayOpen - dayLow;
    const openToHighPoints = dayHigh - dayOpen;
    const isRising = currentPrice > previousPrice;
    const isFalling = currentPrice < previousPrice;

    const hasStrongDropFromOpen = openToLowPoints >= MIN_REVERSAL_POINTS;
    const hasStrongRiseFromOpen = openToHighPoints >= MIN_REVERSAL_POINTS;

    const buyReversalSignal = hasStrongDropFromOpen && isRising;
    const sellReversalSignal = hasStrongRiseFromOpen && isFalling && currentPrice > dayOpen;

    const stopLevels = RiskCalculator.calculateStopLevels(
      currentPrice,
      dailyChange > 0 ? 'uptrend' : 'downtrend',
      dayLow,
      dayHigh,
      dayHigh - dayLow
    );

    const risk = RiskCalculator.calculateFullRisk(
      currentPrice,
      accountSize,
      stopLevels.stopLossPoints,
      stopLevels.takeProfitPoints,
      1
    );

    setRiskCalculation(risk);

    const signal: TradeSignal = {
      // Regra operacional solicitada:
      // - Se abriu e foi ao fundo >= 4.000 pontos, começou a subir => COMPRA
      // - Se abriu e foi ao topo >= 4.000 pontos, começou a cair para voltar da abertura => VENDA
      type: buyReversalSignal ? 'BUY' : sellReversalSignal ? 'SELL' : 'WAIT',
      confidence: Math.min(
        100,
        Math.max(openToLowPoints, openToHighPoints) / MIN_REVERSAL_POINTS * 100
      ),
      reason: [
        `Variacao diaria: ${dailyChange.toFixed(2)}%`,
        `Abertura -> Fundo: ${openToLowPoints.toFixed(0)} pts`,
        `Abertura -> Topo: ${openToHighPoints.toFixed(0)} pts`,
        `Direcao atual: ${isRising ? 'subindo' : isFalling ? 'descendo' : 'lateral'}`,
        `Razao risco/recompensa: ${risk.riskRewardRatio}`,
        `Contratos permitidos: ${risk.contractsAllowed}`,
      ],
      conditions: {
        priceMovement: buyReversalSignal || sellReversalSignal,
        breakoutConfirmed:
          openToLowPoints >= MIN_REVERSAL_POINTS || openToHighPoints >= MIN_REVERSAL_POINTS,
        volumeAboveAverage: true,
        alignmentMultiframe: true,
        technicalAlignment: true,
      },
      timestamp: new Date(),
    };

    setTradeSignal(signal);
    previousPriceRef.current = currentPrice;
  };

  const handleAddOperation = (operation: TradeOperation) => {
    setOperations([...operations, operation]);
  };

  const handleDeleteOperation = (id: string) => {
    setOperations(operations.filter(op => op.id !== id));
  };

  const generateTaxDeclaration = () => {
    try {
      let declaration: TaxDeclaration;
      if (selectedMonth) {
        declaration = TaxCalculator.calculateMonthlyDeclaration(operations, selectedYear, selectedMonth);
      } else {
        declaration = TaxCalculator.calculateAnnualDeclaration(operations, selectedYear);
      }
      setTaxDeclaration(declaration);
    } catch (error) {
      console.error('Erro ao gerar declaração:', error);
    }
  };

  useEffect(() => {
    calculateRisk();
  }, [accountSize, currentPrice, dayOpen, dayHigh, dayLow]);

  const dailyChange = RiskCalculator.calculateDailyChangePercent(currentPrice, dayOpen);
  const isPositive = dailyChange > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">WIN Monitor</h1>
              <p className="text-sm text-muted-foreground mt-1">Simulador de Risco - Mini Indice Brasileiro</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-foreground">{currentPrice.toFixed(0)}</div>
              <div className={`text-sm font-semibold ${isPositive ? 'text-chart-1' : 'text-chart-2'}`}>
                {isPositive ? '+' : ''}{dailyChange.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2 font-semibold border-b-2 ${
              activeTab === 'simulator'
                ? 'border-chart-1 text-chart-1'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Simulador
          </button>
          <button
            onClick={() => setActiveTab('operations')}
            className={`px-4 py-2 font-semibold border-b-2 ${
              activeTab === 'operations'
                ? 'border-chart-1 text-chart-1'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Operações
          </button>
          <button
            onClick={() => setActiveTab('taxes')}
            className={`px-4 py-2 font-semibold border-b-2 ${
              activeTab === 'taxes'
                ? 'border-chart-1 text-chart-1'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Impostos
          </button>
        </div>

        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card className="p-6 border border-border">
                <h2 className="text-lg font-bold text-foreground mb-6">Configuracoes</h2>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-foreground">Capital da Conta (R$)</Label>
                    <Input
                      type="number"
                      value={accountSize}
                      onChange={(e) => setAccountSize(Number(e.target.value))}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-foreground">Preco Atual</Label>
                    <Input
                      type="number"
                      value={currentPrice}
                      onChange={(e) => setCurrentPrice(Number(e.target.value))}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-foreground">Abertura do Dia</Label>
                    <Input
                      type="number"
                      value={dayOpen}
                      onChange={(e) => setDayOpen(Number(e.target.value))}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-foreground">Maxima do Dia</Label>
                    <Input
                      type="number"
                      value={dayHigh}
                      onChange={(e) => setDayHigh(Number(e.target.value))}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-foreground">Minima do Dia</Label>
                    <Input
                      type="number"
                      value={dayLow}
                      onChange={(e) => setDayLow(Number(e.target.value))}
                      className="mt-2"
                    />
                  </div>

                  <Button
                    onClick={fetchMarketData}
                    disabled={loading}
                    className="w-full bg-chart-1 text-white hover:bg-chart-1/90"
                  >
                    <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Carregando...' : 'Atualizar Dados'}
                  </Button>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
              {tradeSignal && (
                <Card
                  className={`p-6 border-2 ${
                    tradeSignal.type === 'BUY'
                      ? 'border-chart-1 bg-chart-1 bg-opacity-5'
                      : tradeSignal.type === 'SELL'
                        ? 'border-chart-2 bg-chart-2 bg-opacity-5'
                        : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-foreground">Sinal de Operacao</h3>
                    <div
                      className={`px-4 py-2 rounded font-bold text-white ${
                        tradeSignal.type === 'BUY'
                          ? 'bg-chart-1'
                          : tradeSignal.type === 'SELL'
                            ? 'bg-chart-2'
                            : 'bg-muted'
                      }`}
                    >
                      {tradeSignal.type === 'BUY' && <TrendingUp className="inline mr-2" size={18} />}
                      {tradeSignal.type === 'SELL' && <TrendingDown className="inline mr-2" size={18} />}
                      {tradeSignal.type}
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="text-sm text-muted-foreground mb-2">Confianca: {tradeSignal.confidence.toFixed(0)}%</div>
                    <div className="w-full bg-border rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          tradeSignal.type === 'BUY' ? 'bg-chart-1' : 'bg-chart-2'
                        }`}
                        style={{ width: `${tradeSignal.confidence}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {tradeSignal.reason.map((reason: string, idx: number) => (
                      <div key={idx} className="text-sm text-foreground flex items-start">
                        <span className="mr-2">•</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {riskCalculation && (
                <Card className="p-6 border border-border">
                  <h3 className="text-lg font-bold text-foreground mb-6">Gestao de Risco</h3>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-secondary p-4 rounded">
                      <div className="text-xs text-muted-foreground font-semibold mb-1">RISCO MAXIMO</div>
                      <div className="text-xl font-bold text-foreground">
                        R$ {riskCalculation.maxRiskAmount.toFixed(2)}
                      </div>
                    </div>

                    <div className="bg-secondary p-4 rounded">
                      <div className="text-xs text-muted-foreground font-semibold mb-1">CONTRATOS PERMITIDOS</div>
                      <div className="text-xl font-bold text-foreground">{riskCalculation.contractsAllowed}</div>
                    </div>

                    <div className="bg-secondary p-4 rounded">
                      <div className="text-xs text-muted-foreground font-semibold mb-1">RAZAO RISCO/RECOMPENSA</div>
                      <div className="text-xl font-bold text-foreground">
                        1:{riskCalculation.riskRewardRatio.toFixed(2)}
                      </div>
                    </div>

                    <div className="bg-secondary p-4 rounded">
                      <div className="text-xs text-muted-foreground font-semibold mb-1">STOP LOSS POINTS</div>
                      <div className="text-xl font-bold text-chart-2">{riskCalculation.stopLossPoints}</div>
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-border pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Preco de Entrada</span>
                      <span className="font-semibold text-foreground">{riskCalculation.entryPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Stop Loss</span>
                      <span className="font-semibold text-chart-2">{riskCalculation.stopLossPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Take Profit</span>
                      <span className="font-semibold text-chart-1">{riskCalculation.takeProfitPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {activeTab === 'operations' && (
          <OperationsForm
            onAddOperation={handleAddOperation}
            operations={operations}
            onDeleteOperation={handleDeleteOperation}
          />
        )}

        {activeTab === 'taxes' && (
          <div className="space-y-6">
            <Card className="p-6 border border-border">
              <h3 className="text-lg font-bold text-foreground mb-4">Gerar Declaracao de Impostos</h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="text-sm font-medium text-foreground">Ano</Label>
                  <Input
                    type="number"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-foreground">Mês (opcional)</Label>
                  <select
                    value={selectedMonth || ''}
                    onChange={(e) => setSelectedMonth(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full mt-2 px-3 py-2 border border-border rounded bg-background text-foreground"
                  >
                    <option value="">Anual</option>
                    <option value="1">Janeiro</option>
                    <option value="2">Fevereiro</option>
                    <option value="3">Março</option>
                    <option value="4">Abril</option>
                    <option value="5">Maio</option>
                    <option value="6">Junho</option>
                    <option value="7">Julho</option>
                    <option value="8">Agosto</option>
                    <option value="9">Setembro</option>
                    <option value="10">Outubro</option>
                    <option value="11">Novembro</option>
                    <option value="12">Dezembro</option>
                  </select>
                </div>
              </div>

              <Button
                onClick={generateTaxDeclaration}
                className="w-full bg-chart-1 text-white hover:bg-chart-1/90"
              >
                Gerar Declaracao
              </Button>
            </Card>

            {taxDeclaration && <TaxDeclarationReport declaration={taxDeclaration} />}
          </div>
        )}
      </main>
    </div>
  );
}
