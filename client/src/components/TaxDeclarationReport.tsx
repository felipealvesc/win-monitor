import { TaxDeclaration } from '@/types/operations';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';

interface TaxDeclarationReportProps {
  declaration: TaxDeclaration;
}

export default function TaxDeclarationReport({ declaration }: TaxDeclarationReportProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const generatePDF = () => {
    const content = `
DECLARAÇÃO DE OPERAÇÕES COM ATIVOS FINANCEIROS
Ano: ${declaration.year}
${declaration.month ? `Mês: ${declaration.month}` : ''}
Gerado em: ${declaration.generatedAt.toLocaleDateString('pt-BR')}

=== RESUMO GERAL ===
Total de Operações: ${declaration.totalOperations}
Valor Total de Compras: ${formatCurrency(declaration.totalBuyValue)}
Valor Total de Vendas: ${formatCurrency(declaration.totalSellValue)}
Lucro Bruto: ${formatCurrency(declaration.totalGrossProfit)}
Taxas de Corretagem: ${formatCurrency(declaration.totalBrokerageFees)}
Lucro Líquido: ${formatCurrency(declaration.totalNetProfit)}
Imposto de Renda Total: ${formatCurrency(declaration.totalIRTax)}

=== OPERAÇÕES DE DAY TRADE ===
Quantidade: ${declaration.dayTradeOperations}
Lucro Líquido: ${formatCurrency(declaration.dayTradeProfit)}
Alíquota: 20%
Imposto de Renda: ${formatCurrency(declaration.dayTradeTax)}

=== OPERAÇÕES DE SWING TRADE ===
Quantidade: ${declaration.swingTradeOperations}
Lucro Líquido: ${formatCurrency(declaration.swingTradeProfit)}
Alíquota: 15%
Imposto de Renda: ${formatCurrency(declaration.swingTradeTax)}

=== INFORMAÇÕES IMPORTANTES ===
- Day Trade: Operações com entrada e saída no mesmo dia (alíquota 20%)
- Swing Trade: Operações com mais de um dia (alíquota 15%)
- As taxas de corretagem são dedutíveis do lucro
- Este documento é apenas informativo e não substitui a declaração oficial ao fisco

Gerado por: WIN Monitor - Simulador de Risco
    `;

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute(
      'download',
      `declaracao_${declaration.year}${declaration.month ? `_${declaration.month}` : ''}.txt`
    );
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-border">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <FileText className="mr-3 text-chart-1" size={24} />
            <div>
              <h3 className="text-lg font-bold text-foreground">Declaração de Impostos</h3>
              <p className="text-sm text-muted-foreground">
                {declaration.month
                  ? `${declaration.month}/${declaration.year}`
                  : `Ano ${declaration.year}`}
              </p>
            </div>
          </div>
          <Button
            onClick={generatePDF}
            className="bg-chart-1 text-white hover:bg-chart-1/90 flex items-center"
          >
            <Download size={18} className="mr-2" />
            Baixar
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-secondary p-4 rounded">
            <div className="text-xs text-muted-foreground font-semibold mb-1">TOTAL DE OPERAÇÕES</div>
            <div className="text-2xl font-bold text-foreground">{declaration.totalOperations}</div>
          </div>

          <div className="bg-secondary p-4 rounded">
            <div className="text-xs text-muted-foreground font-semibold mb-1">LUCRO LÍQUIDO</div>
            <div className={`text-2xl font-bold ${declaration.totalNetProfit >= 0 ? 'text-chart-1' : 'text-chart-2'}`}>
              {formatCurrency(declaration.totalNetProfit)}
            </div>
          </div>

          <div className="bg-secondary p-4 rounded">
            <div className="text-xs text-muted-foreground font-semibold mb-1">IMPOSTO DE RENDA</div>
            <div className="text-2xl font-bold text-chart-2">{formatCurrency(declaration.totalIRTax)}</div>
          </div>

          <div className="bg-secondary p-4 rounded">
            <div className="text-xs text-muted-foreground font-semibold mb-1">TAXAS DE CORRETAGEM</div>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(declaration.totalBrokerageFees)}
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h4 className="font-bold text-foreground mb-4">Detalhamento</h4>

          <div className="space-y-4">
            <div className="bg-secondary p-4 rounded">
              <h5 className="font-semibold text-foreground mb-3">Day Trade (Alíquota: 20%)</h5>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Operações</div>
                  <div className="font-bold text-foreground">{declaration.dayTradeOperations}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Lucro Líquido</div>
                  <div className={`font-bold ${declaration.dayTradeProfit >= 0 ? 'text-chart-1' : 'text-chart-2'}`}>
                    {formatCurrency(declaration.dayTradeProfit)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Imposto</div>
                  <div className="font-bold text-chart-2">{formatCurrency(declaration.dayTradeTax)}</div>
                </div>
              </div>
            </div>

            <div className="bg-secondary p-4 rounded">
              <h5 className="font-semibold text-foreground mb-3">Swing Trade (Alíquota: 15%)</h5>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Operações</div>
                  <div className="font-bold text-foreground">{declaration.swingTradeOperations}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Lucro Líquido</div>
                  <div className={`font-bold ${declaration.swingTradeProfit >= 0 ? 'text-chart-1' : 'text-chart-2'}`}>
                    {formatCurrency(declaration.swingTradeProfit)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Imposto</div>
                  <div className="font-bold text-chart-2">{formatCurrency(declaration.swingTradeTax)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6 mt-6">
          <p className="text-xs text-muted-foreground">
            ⚠️ Este documento é apenas informativo. Consulte um contador para a declaração oficial ao fisco.
          </p>
        </div>
      </Card>
    </div>
  );
}
