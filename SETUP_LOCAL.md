# WIN Monitor - Guia de Instalação Local

## Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** (versão 18 ou superior): https://nodejs.org/
- **npm** ou **pnpm** (gerenciador de pacotes)
- **Git** (opcional, para clonar o repositório)

## Passo 1: Clonar ou Baixar o Projeto

### Opção A: Clonar via Git
```bash
git clone <seu-repositorio-url>
cd win-monitor
```

### Opção B: Baixar os arquivos
Baixe os arquivos do projeto e descompacte em uma pasta de sua escolha, depois navegue até ela:
```bash
cd win-monitor
```

## Passo 2: Configurar Token da API (Importante!)

### Caminho do MetaTrader 5 (opcional)

Se você pretende utilizar a funcionalidade de leitura de dados do MetaTrader 5,
verifique que o terminal esteja instalado no caminho padrão `C:\Program Files\MetaTrader 5 Terminal`.

Caso o MT5 esteja em um local diferente (por exemplo, instalação portátil), crie
ou atualize a variável de ambiente `MT5_INSTALL_PATH` apontando para a pasta
da instalação antes de iniciar o servidor.

Exemplo no Windows (PowerShell):

```powershell
$env:MT5_INSTALL_PATH = 'C:\Program Files\MetaTrader 5 Terminal'
npm run dev
```

A aplicação exibirá notas com o caminho pesquisado caso não encontre a instalação.


O projeto ja vem com dados simulados realistas para teste. Voce pode usar imediatamente!

### Como obter o token:

1. Acesse: https://brapi.dev/
2. Clique em **"Get Free API Key"**
3. Preencha o formulário com seus dados
4. Confirme seu email
5. Você receberá um token (chave de API)

### Configurar o token localmente:

1. Na raiz do projeto, crie um arquivo chamado `.env.local`
2. Adicione a seguinte linha:

```
VITE_BRAPI_TOKEN=seu_token_aqui
```

Substituir `seu_token_aqui` pelo token que você recebeu.

**Exemplo:**
```
VITE_BRAPI_TOKEN=abc123def456ghi789jkl
```

⚠️ **Importante**: Nunca compartilhe seu token publicamente!

---

## Passo 3: Instalar Dependências

Execute o comando abaixo para instalar todas as dependências do projeto:

```bash
npm install
```

Ou se preferir usar pnpm:
```bash
pnpm install
```

**Tempo estimado**: 2-5 minutos (depende da sua conexão)

## Passo 4: Executar o Servidor de Desenvolvimento

Para iniciar o servidor local:

```bash
npm run dev
```

Ou com pnpm:
```bash
pnpm dev
```

Você verá uma saída similar a:
```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.x.x:5173/
```

## Passo 5: Acessar a Aplicação

Abra seu navegador e acesse:
- **Local**: http://localhost:5173/
- **Rede**: http://192.168.x.x:5173/ (para acessar de outro dispositivo)

## Comandos Disponíveis

### Desenvolvimento
```bash
npm run dev
```
Inicia o servidor de desenvolvimento com hot reload (atualização automática ao salvar arquivos).

### Build para Produção
```bash
npm run build
```
Compila o projeto para produção (pasta `dist/`).

### Preview de Produção
```bash
npm run preview
```
Visualiza a versão de produção localmente.

### Verificar Tipos TypeScript
```bash
npm run check
```
Verifica erros de tipagem sem compilar.

### Formatar Código
```bash
npm run format
```
Formata o código usando Prettier.

## Estrutura do Projeto

```
win-monitor/
├── client/                 # Código frontend (React)
│   ├── src/
│   │   ├── pages/         # Páginas da aplicação
│   │   ├── components/    # Componentes reutilizáveis
│   │   ├── lib/           # Utilitários e serviços
│   │   ├── types/         # Tipos TypeScript
│   │   ├── contexts/      # Contextos React
│   │   ├── hooks/         # Hooks customizados
│   │   ├── App.tsx        # Componente raiz
│   │   ├── main.tsx       # Ponto de entrada
│   │   └── index.css      # Estilos globais
│   ├── public/            # Arquivos estáticos
│   └── index.html         # HTML principal
├── server/                # Código backend (placeholder)
├── shared/                # Tipos compartilhados
├── package.json           # Dependências do projeto
├── tsconfig.json          # Configuração TypeScript
├── vite.config.ts         # Configuração Vite
└── tailwind.config.ts     # Configuração Tailwind CSS
```

## Funcionalidades Principais

### 1. Simulador de Risco
- Monitore o mini índice WIN em tempo real
- Calcule automaticamente stop loss e take profit
- Receba sinais de operação (BUY/SELL/WAIT)
- Valide razão risco/recompensa

### 2. Registro de Operações
- Registre suas compras e vendas
- Calcule lucro/prejuízo automaticamente
- Inclua taxas de corretagem
- Visualize histórico de operações

### 3. Cálculo de Impostos
- Calcule automaticamente o imposto de renda
- Alíquota de 20% para day trade
- Alíquota de 15% para swing trade
- Deduza taxas de corretagem
- Gere relatório mensal ou anual

## Solução de Problemas

### Erro: "npm: command not found"
- Node.js não está instalado. Baixe em: https://nodejs.org/

### Erro: "Port 5173 is already in use"
- A porta 5173 já está em uso. Use:
```bash
npm run dev -- --port 3000
```

### Erro: "Module not found"
- Reinstale as dependências:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Aplicação não atualiza ao salvar arquivos
- Verifique se o servidor está rodando com `npm run dev`
- Tente fazer refresh manual (F5 ou Ctrl+R)

## Tecnologias Utilizadas

- **React 19** - Framework frontend
- **TypeScript** - Tipagem estática
- **Tailwind CSS 4** - Estilização
- **Vite** - Build tool
- **shadcn/ui** - Componentes UI
- **Lucide React** - Ícones
- **Wouter** - Roteamento
- **Recharts** - Gráficos (preparado para uso futuro)

## Integração com API

O projeto já está configurado para integrar com:
- **BrAPI** - Dados do mini índice WIN em tempo real
- **Yahoo Finance** - Dados históricos de ações

Basta clicar em "Atualizar Dados" no simulador para buscar dados em tempo real.

## Dicas de Desenvolvimento

1. **Hot Reload**: Qualquer alteração em `client/src/` será refletida automaticamente
2. **DevTools**: Use F12 para abrir o console do navegador
3. **TypeScript**: Erros de tipo aparecem no terminal durante desenvolvimento
4. **Tailwind**: Use classes do Tailwind diretamente nos componentes

## Próximos Passos

1. Explore a aba "Simulador" para testar a gestão de risco
2. Registre operações na aba "Operações"
3. Gere declaração de impostos na aba "Impostos"
4. Customize as configurações conforme sua estratégia

## Suporte

Para dúvidas ou problemas:
1. Verifique a documentação do Vite: https://vitejs.dev/
2. Consulte a documentação do React: https://react.dev/
3. Veja exemplos de Tailwind: https://tailwindcss.com/

---

**Última atualização**: Fevereiro 2026
**Versão**: 2.0
