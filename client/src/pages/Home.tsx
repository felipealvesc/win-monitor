import { useState, useEffect } from 'react';
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

const WEBHOOK_URL = import.meta.env.VITE_SIGNAL_WEBHOOK_URL || 'https://example.com/webhook';
const SIGNAL_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const OHLC_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const MIN_RISK_REWARD = 1.5;
const EXTREME_BUFFER_POINTS = 100;
const DAILY_TARGET = 1000;
const DAILY_STOP = -600;
const MAX_TRADES = 5;

export default function Home() {
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
  const [lastExtreme, setLastExtreme] = useState<'HIGH' | 'LOW' | null>(null);
  const [extremePrice, setExtremePrice] = useState<number | null>(null);
  const [tradeLockedReason, setTradeLockedReason] = useState<string | null>(null);

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

  const getTodayTrades = () => {
    const today = new Date().toDateString();
    return operations.filter(
      op => op.status === 'CLOSED' && op.exitDate && new Date(op.exitDate).toDateString() === today
    );
  };

  const getTodayPnL = () => {
    return getTodayTrades().reduce((acc, op) => {
      const entryValue = op.quantity * op.entryPrice;
      const exitValue = op.quantity * (op.exitPrice || 0);
      const gross = op.type === 'BUY' ? exitValue - entryValue : entryValue - exitValue;
      return acc + (gross - op.brokerageFee);
    }, 0);
  };

  const getTradeLockReason = () => {
    const todayTrades = getTodayTrades();
    const todayPnL = getTodayPnL();

    if (todayPnL >= DAILY_TARGET) return 'Daily target atingido';
    if (todayPnL <= DAILY_STOP) return 'Daily stop atingido';
    if (todayTrades.length >= MAX_TRADES) return 'Máximo de operações do dia atingido';
    return null;
  };

  const calculateRisk = () => {
    const dailyChange = RiskCalculator.calculateDailyChangePercent(currentPrice, dayOpen);
    const hasOnePercent = RiskCalculator.checkOnePercentThreshold(currentPrice, dayOpen);
    const lockReason = getTradeLockReason();
    setTradeLockedReason(lockReason);

    const madeNewHigh = currentPrice >= dayHigh;
    const madeNewLow = currentPrice <= dayLow;

    if (madeNewHigh) {
      setLastExtreme('HIGH');
      setExtremePrice(currentPrice);
    }

    if (madeNewLow) {
      setLastExtreme('LOW');
      setExtremePrice(currentPrice);
    }

    const effectiveExtreme = extremePrice ?? (lastExtreme === 'HIGH' ? dayHigh : dayLow);
    const range = Math.max(dayHigh - dayLow, 1);
    const pivotBuffer = Math.max(range * 0.1, 50);

    const reversalConfirmed =
      lastExtreme === 'HIGH'
        ? currentPrice <= (effectiveExtreme || dayHigh) - pivotBuffer
        : lastExtreme === 'LOW'
          ? currentPrice >= (effectiveExtreme || dayLow) + pivotBuffer
          : false;

    const technicalStopPrice =
      lastExtreme === 'HIGH'
        ? (effectiveExtreme || dayHigh) + EXTREME_BUFFER_POINTS
        : lastExtreme === 'LOW'
          ? (effectiveExtreme || dayLow) - EXTREME_BUFFER_POINTS
          : currentPrice;

    const stopLossPoints = Math.max(
      1,
      Math.round(Math.abs((currentPrice - technicalStopPrice) / 0.2))
    );

    const takeProfitPoints = stopLossPoints;

    const risk = RiskCalculator.calculateFullRisk(
      currentPrice,
      accountSize,
      stopLossPoints,
      takeProfitPoints,
      1
    );

    const isBusinessRuleValid =
      hasOnePercent && (madeNewHigh || madeNewLow || !!lastExtreme) && reversalConfirmed;
    const hasMinRiskReward = risk.riskRewardRatio >= MIN_RISK_REWARD;
    const canTrade = isBusinessRuleValid && hasMinRiskReward && !lockReason;

    setRiskCalculation(risk);

    const signal: TradeSignal = {
      type: canTrade ? (dailyChange > 0 ? 'SELL' : 'BUY') : 'WAIT',
      confidence: Math.min(100, Math.abs(dailyChange) * 50),
      reason: [
        `Variacao diaria: ${dailyChange.toFixed(2)}%`,
        `Razao risco/recompensa: ${risk.riskRewardRatio}`,
        `Contratos permitidos: ${risk.contractsAllowed}`,
        `Stop técnico: ${technicalStopPrice.toFixed(0)} (${stopLossPoints} pontos)`,
        `Parcial: 1R | Trailing: ativado após 1R`,
        lockReason ? `TRAVA: ${lockReason}` : 'Sem trava diária',
      ],
      conditions: {
        priceMovement: hasOnePercent,
        breakoutConfirmed: reversalConfirmed,
        volumeAboveAverage: true,
        alignmentMultiframe: madeNewHigh || madeNewLow || !!lastExtreme,
        technicalAlignment: hasMinRiskReward,
      },
      timestamp: new Date(),
    };

    setTradeSignal(signal);
  };


  const sendSignalWebhook = async (signal: TradeSignal, risk: RiskCalculation, dailyChangeValue: number) => {
    try {
      const payload = {
        message: `Sinal ${signal.type} detectado para WINJ26 com variação de ${dailyChangeValue.toFixed(2)}%`,
        symbol: 'WINJ26',
        signalType: signal.type,
        confidence: signal.confidence,
        market: {
          currentPrice,
          dayOpen,
          dayHigh,
          dayLow,
          dailyChangePercent: dailyChangeValue,
        },
        risk: {
          contractsAllowed: risk.contractsAllowed,
          maxRiskAmount: risk.maxRiskAmount,
          stopLossPoints: risk.stopLossPoints,
          takeProfitPoints: risk.takeProfitPoints,
          riskRewardRatio: risk.riskRewardRatio,
        },
        timestamp: new Date().toISOString(),
      };

      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Erro ao enviar webhook de sinal:', error);
    }
  };

  const checkSignalAndNotify = async () => {
    const dailyChangeValue = RiskCalculator.calculateDailyChangePercent(currentPrice, dayOpen);
    const hasOnePercent = RiskCalculator.checkOnePercentThreshold(currentPrice, dayOpen);
    const lockReason = getTradeLockReason();

    if (lockReason) {
      return;
    }

    if (!hasOnePercent) {
      return;
    }

    const range = Math.max(dayHigh - dayLow, 1);
    const pivotBuffer = Math.max(range * 0.1, 50);
    const effectiveExtreme = extremePrice ?? (lastExtreme === 'HIGH' ? dayHigh : dayLow);
    const reversalConfirmed =
      lastExtreme === 'HIGH'
        ? currentPrice <= (effectiveExtreme || dayHigh) - pivotBuffer
        : lastExtreme === 'LOW'
          ? currentPrice >= (effectiveExtreme || dayLow) + pivotBuffer
          : false;

    const technicalStopPrice =
      lastExtreme === 'HIGH'
        ? (effectiveExtreme || dayHigh) + EXTREME_BUFFER_POINTS
        : lastExtreme === 'LOW'
          ? (effectiveExtreme || dayLow) - EXTREME_BUFFER_POINTS
          : currentPrice;

    const stopLossPoints = Math.max(1, Math.round(Math.abs((currentPrice - technicalStopPrice) / 0.2)));
    const takeProfitPoints = stopLossPoints;

    const risk = RiskCalculator.calculateFullRisk(
      currentPrice,
      accountSize,
      stopLossPoints,
      takeProfitPoints,
      1
    );

    const hasMinRiskReward = risk.riskRewardRatio >= MIN_RISK_REWARD;
    if (!reversalConfirmed || !hasMinRiskReward || !lastExtreme) {
      return;
    }

    const signal: TradeSignal = {
      type: dailyChangeValue > 0 ? 'SELL' : 'BUY',
      confidence: Math.min(100, Math.abs(dailyChangeValue) * 50),
      reason: [
        `Variacao diaria: ${dailyChangeValue.toFixed(2)}%`,
        `Razao risco/recompensa: ${risk.riskRewardRatio}`,
        `Contratos permitidos: ${risk.contractsAllowed}`,
      ],
      conditions: {
        priceMovement: hasOnePercent,
        breakoutConfirmed: Math.abs(dailyChangeValue) > 1.5,
        volumeAboveAverage: true,
        alignmentMultiframe: true,
        technicalAlignment: true,
      },
      timestamp: new Date(),
    };

    await sendSignalWebhook(signal, risk, dailyChangeValue);
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
  }, [accountSize, currentPrice, dayOpen, dayHigh, dayLow, operations, lastExtreme, extremePrice]);

  useEffect(() => {
    fetchMarketData();
    const timer = setInterval(() => {
      fetchMarketData();
    }, OHLC_REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      checkSignalAndNotify();
    }, SIGNAL_CHECK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [accountSize, currentPrice, dayOpen, dayHigh, dayLow, lastExtreme, extremePrice, operations]);

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
