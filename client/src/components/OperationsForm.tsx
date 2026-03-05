import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  calculateOperationAmounts,
  formatOperationPrice,
  getPriceInputStep,
} from '@/lib/operationCalculator';
import { TradeOperation } from '@/types/operations';
import { Plus, Trash2, Edit2 } from 'lucide-react';

interface OperationsFormProps {
  onAddOperation: (operation: TradeOperation) => void;
  operations: TradeOperation[];
  onDeleteOperation: (id: string) => void;
  onEditOperation?: (operation: TradeOperation) => void;

  // when provided, the form will load this operation for editing
  initialOperation?: TradeOperation | null;
  // called on submit when editing instead of onAddOperation
  onUpdateOperation?: (operation: TradeOperation) => void;
  onCancelEdit?: () => void;
}

export default function OperationsForm({
  onAddOperation,
  operations,
  onDeleteOperation,
  onEditOperation,
  initialOperation,
  onUpdateOperation,
  onCancelEdit,
}: OperationsFormProps) {
  const [priceInputStep, setPriceInputStep] = useState('0.001');
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

  // when the initialOperation prop changes we need to populate the form

  // update local state when initialOperation changes
  useEffect(() => {
    if (initialOperation) {
      setFormData({
        type: initialOperation.type,
        symbol: initialOperation.symbol,
        quantity: initialOperation.quantity,
        entryPrice: initialOperation.entryPrice,
        exitPrice: initialOperation.exitPrice || 0,
        entryDate: initialOperation.entryDate.toISOString().split('T')[0],
        exitDate: initialOperation.exitDate
          ? initialOperation.exitDate.toISOString().split('T')[0]
          : '',
        brokerageFee: initialOperation.brokerageFee,
        notes: initialOperation.notes || '',
      });
    }
  }, [initialOperation]);

  useEffect(() => {
    setPriceInputStep(getPriceInputStep(formData.symbol));
  }, [formData.symbol]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // validations
    if (!formData.symbol.trim()) {
      alert('Símbolo é obrigatório');
      return;
    }
    if (formData.quantity <= 0) {
      alert('Quantidade deve ser maior que zero');
      return;
    }
    if (!formData.exitDate) {
      alert('Data de saída é obrigatória');
      return;
    }
    if (new Date(formData.exitDate) < new Date(formData.entryDate)) {
      alert('Data de saída não pode ser anterior à entrada');
      return;
    }

    const baseOp: Omit<TradeOperation, 'id'> = {
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

    if (initialOperation && initialOperation.id && onUpdateOperation) {
      onUpdateOperation({ ...baseOp, id: initialOperation.id });
    } else {
      onAddOperation({ ...baseOp, id: `${Date.now()}-${Math.random()}` });
    }

    // reset form after submit (and cancel edit if necessary)
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
    if (initialOperation && onCancelEdit) {
      onCancelEdit();
    }
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
                step={priceInputStep}
                value={formData.entryPrice}
                onChange={(e) => setFormData({ ...formData, entryPrice: Number(e.target.value) })}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground">Preço de Saída</Label>
              <Input
                type="number"
                step={priceInputStep}
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

          <div className="flex gap-2">
            <Button type="submit" className="flex-1 bg-chart-1 text-white hover:bg-chart-1/90">
              <Plus size={18} className="mr-2" />
              {initialOperation ? 'Salvar Alterações' : 'Adicionar Operação'}
            </Button>
            {initialOperation && onCancelEdit && (
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={onCancelEdit}
              >
                Cancelar
              </Button>
            )}
          </div>
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
                  const { netProfit } = calculateOperationAmounts(op);

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
                      <td className="py-2 px-2">{formatOperationPrice(op.entryPrice, op.symbol)}</td>
                      <td className="py-2 px-2">{formatOperationPrice(op.exitPrice, op.symbol)}</td>
                      <td className={`py-2 px-2 font-semibold ${netProfit >= 0 ? 'text-chart-1' : 'text-chart-2'}`}>
                        R$ {netProfit.toFixed(2)}
                      </td>
                      <td className="py-2 px-2 flex gap-2">
                        {onEditOperation && (
                          <button
                            onClick={() => onEditOperation(op)}
                            className="text-chart-1 hover:text-chart-1/80"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
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
