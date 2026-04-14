# Deploy no Hostinger VPS

## Arquitetura recomendada

- **Hostinger VPS (Linux):** frontend React compilado + backend Node/Express
- **Máquina Windows com MT5:** Python API opcional com acesso ao MetaTrader 5
- **Comunicação entre Node e Python:** variável `PY_API_BASE_URL`

> O MetaTrader 5 e o pacote `MetaTrader5` foram desenhados para ambiente Windows. Em um VPS Linux da Hostinger, o caminho mais seguro é manter o MT5 em uma máquina Windows e apontar o Node para essa API Python remota.

## Cenário 1 — Deploy só do painel no VPS

Use quando quiser publicar a interface, operações, relatórios e backend base.

1. Suba o código no VPS.
2. Crie o arquivo `.env` a partir de `.env.example`.
3. Ajuste:
   - `PORT=3000`
   - `PY_API_BASE_URL=` para sua API Python remota, se existir
4. Build e start:

```bash
corepack enable
pnpm install
pnpm build
NODE_ENV=production node dist/index.js
```

## Cenário 2 — Deploy com Docker no VPS

```bash
docker compose up -d --build
```

Depois, configure o Nginx para proxy reverso para `http://127.0.0.1:3000`.

## Exemplo de Nginx

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## API Python remota

Na máquina Windows onde o MT5 estiver rodando:

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r python_api/requirements.txt
python -m uvicorn python_api.main:app --host 0.0.0.0 --port 3002
```

Depois, no VPS:

```env
PY_API_BASE_URL=http://IP_DA_MAQUINA_WINDOWS:3002
```

## Variáveis mínimas para produção

```env
NODE_ENV=production
PORT=3000
PY_API_BASE_URL=http://IP_DA_API_PYTHON:3002
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
SIGNAL_SYMBOL=WINJ26
SIGNAL_MIN_CONFIDENCE=80
SIGNAL_MIN_CHANGE_POINTS=400
```

## Observações

- Se a API Python ficar indisponível, o backend Node cai para o cálculo legado local quando houver acesso ao MT5 na mesma máquina.
- Em VPS Linux sem MT5 local, deixe `PY_API_BASE_URL` apontando para uma API Python externa.
- Para segurança, exponha a API Python apenas por VPN, Tailscale, túnel privado ou IP restrito.
