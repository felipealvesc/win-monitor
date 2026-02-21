import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TradeOperation } from '@/types/operations';
import { Plus, Trash2 } from 'lucide-react';

interface OperationsFormProps {
  onAddOperation: (operation: TradeOperation) => void;
  operations: TradeOperation[];
  onDeleteOperation: (id: string) => void;
}

export default function OperationsForm({
  onAddOperation,
  operations,
  onDeleteOperation,
}: OperationsFormProps) {
  const [formData, setFormData] = useState({
    type: 'BUY' as 'BUY' | 'SELL',
    symbol: 'WINJ26',
    quantity: 1,
    entryPrice: 0,
    exitPrice: 0,
    entryDate: new Date().toISOString().split('T')[0],
    exitDate: '',
    brokerageFee: 0,
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.exitDate) {
      alert('Data de saída é obrigatória');
      return;
    }

    const operation: TradeOperation = {
      id: `${Date.now()}-${Math.random()}`,
      type: formData.type,
      symbol: formData.symbol,
      quantity: formData.quantity,
      entryPrice: formData.entryPrice,
      exitPrice: formData.exitPrice,
      entryDate: new Date(formData.entryDate),
      exitDate: new Date(formData.exitDate),
      brokerageFee: formData.brokerageFee,
      notes: formData.notes,
      status: 'CLOSED',
    };

    onAddOperation(operation);

    setFormData({
      type: 'BUY',
      symbol: 'WINJ26',
      quantity: 1,
      entryPrice: 0,
      exitPrice: 0,
      entryDate: new Date().toISOString().split('T')[0],
      exitDate: '',
      brokerageFee: 0,
      notes: '',
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-border">
        <h3 className="text-lg font-bold text-foreground mb-6">Registrar Operação</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-foreground">Tipo</Label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as 'BUY' | 'SELL' })
                }
                className="w-full mt-2 px-3 py-2 border border-border rounded bg-background text-foreground"
              >
                <option value="BUY">Compra</option>
                <option value="SELL">Venda</option>
              </select>
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground">Símbolo</Label>
              <Input
                type="text"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground">Quantidade</Label>
              <Input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground">Preço de Entrada</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.entryPrice}
                onChange={(e) => setFormData({ ...formData, entryPrice: Number(e.target.value) })}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground">Preço de Saída</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.exitPrice}
                onChange={(e) => setFormData({ ...formData, exitPrice: Number(e.target.value) })}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground">Taxa de Corretagem (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.brokerageFee}
                onChange={(e) => setFormData({ ...formData, brokerageFee: Number(e.target.value) })}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground">Data de Entrada</Label>
              <Input
                type="date"
                value={formData.entryDate}
                onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground">Data de Saída</Label>
              <Input
                type="date"
                value={formData.exitDate}
                onChange={(e) => setFormData({ ...formData, exitDate: e.target.value })}
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-foreground">Notas</Label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full mt-2 px-3 py-2 border border-border rounded bg-background text-foreground"
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full bg-chart-1 text-white hover:bg-chart-1/90">
            <Plus size={18} className="mr-2" />
            Adicionar Operação
          </Button>
        </form>
      </Card>

      {operations.length > 0 && (
        <Card className="p-6 border border-border">
          <h3 className="text-lg font-bold text-foreground mb-4">Operações Registradas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-semibold text-foreground">Tipo</th>
                  <th className="text-left py-2 px-2 font-semibold text-foreground">Símbolo</th>
                  <th className="text-left py-2 px-2 font-semibold text-foreground">Qtd</th>
                  <th className="text-left py-2 px-2 font-semibold text-foreground">Entrada</th>
                  <th className="text-left py-2 px-2 font-semibold text-foreground">Saída</th>
                  <th className="text-left py-2 px-2 font-semibold text-foreground">Lucro/Prejuízo</th>
                  <th className="text-left py-2 px-2 font-semibold text-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((op) => {
                  const entryValue = op.quantity * op.entryPrice;
                  const exitValue = op.quantity * (op.exitPrice || 0);
                  const grossProfit = op.type === 'BUY' ? exitValue - entryValue : entryValue - exitValue;
                  const netProfit = grossProfit - op.brokerageFee;

                  return (
                    <tr key={op.id} className="border-b border-border hover:bg-secondary">
                      <td className="py-2 px-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold text-white ${
                            op.type === 'BUY' ? 'bg-chart-1' : 'bg-chart-2'
                          }`}
                        >
                          {op.type}
                        </span>
                      </td>
                      <td className="py-2 px-2">{op.symbol}</td>
                      <td className="py-2 px-2">{op.quantity}</td>
                      <td className="py-2 px-2">R$ {op.entryPrice.toFixed(2)}</td>
                      <td className="py-2 px-2">R$ {op.exitPrice?.toFixed(2)}</td>
                      <td className={`py-2 px-2 font-semibold ${netProfit >= 0 ? 'text-chart-1' : 'text-chart-2'}`}>
                        R$ {netProfit.toFixed(2)}
                      </td>
                      <td className="py-2 px-2">
                        <button
                          onClick={() => onDeleteOperation(op.id)}
                          className="text-chart-2 hover:text-chart-2/80"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
