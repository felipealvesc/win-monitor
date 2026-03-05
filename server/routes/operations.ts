import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Define a minimal shape for operations stored on disk. The front-end
// already defines a more complete interface (with `Date` objects), but
// when we serialize/deserialize they will arrive as plain strings.  We'll
// mirror the main fields here to keep TypeScript happy.
interface StoredOperation {
  id: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  entryDate: string; // ISO date string
  exitDate?: string;
  brokerageFee: number;
  notes?: string;
  status: 'OPEN' | 'CLOSED';
}

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// where the file will live
const dataDir = path.resolve(__dirname, '..', 'data');
const filePath = path.join(dataDir, 'operations.json');

function ensureFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]');
  }
}

function readOperations(): StoredOperation[] {
  ensureFile();
  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(content) as StoredOperation[];
  } catch {
    // if the file is corrupt we wipe it and return an empty array
    fs.writeFileSync(filePath, '[]');
    return [];
  }
}

function writeOperations(ops: StoredOperation[]) {
  ensureFile();
  fs.writeFileSync(filePath, JSON.stringify(ops, null, 2));
}

// GET /api/operations
router.get('/', (_req, res) => {
  const ops = readOperations();
  // order latest entry first
  ops.sort((a, b) => {
    const da = new Date(a.entryDate).getTime();
    const db = new Date(b.entryDate).getTime();
    return db - da;
  });
  res.json(ops);
});

// POST /api/operations
router.post('/', (req, res) => {
  const op = req.body as StoredOperation;
  if (!op || !op.id) {
    return res.status(400).json({ error: 'Invalid operation payload' });
  }

  // simple validation rules copied from PUT
  if (!op.symbol || op.quantity <= 0) {
    return res.status(400).json({ error: 'Símbolo e quantidade são obrigatórios' });
  }
  if (new Date(op.exitDate || '') < new Date(op.entryDate)) {
    return res.status(400).json({ error: 'Data de saída não pode ser anterior à de entrada' });
  }

  const ops = readOperations();
  ops.push(op);
  writeOperations(ops);
  return res.status(201).json(op);
});

// PUT /api/operations/:id  (update existing operation)
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const updated = req.body as StoredOperation;
  if (!updated || updated.id !== id) {
    return res.status(400).json({ error: 'Invalid operation payload' });
  }

  // very basic validations
  if (!updated.symbol || updated.quantity <= 0) {
    return res.status(400).json({ error: 'Símbolo e quantidade são obrigatórios' });
  }
  if (new Date(updated.exitDate || '') < new Date(updated.entryDate)) {
    return res.status(400).json({ error: 'Data de saída não pode ser anterior à de entrada' });
  }

  let ops = readOperations();
  const index = ops.findIndex(o => o.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Operation not found' });
  }
  ops[index] = updated;
  writeOperations(ops);
  return res.json(updated);
});

// DELETE /api/operations/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  let ops = readOperations();
  const before = ops.length;
  ops = ops.filter(o => o.id !== id);
  if (ops.length === before) {
    return res.status(404).json({ error: 'Operation not found' });
  }
  writeOperations(ops);
  return res.status(204).end();
});

export default router;
