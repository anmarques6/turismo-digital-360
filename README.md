# Angola 365º — v3.4 (Vercel + Postgres) · ENDA AI

Plataforma de turismo de Angola com a guia IA **Kianda**. Uma solução **SIGAF**.

- **Site do turista** (`/`) e **painel de administração** (`/admin/`), servidos pela Vercel a partir de `public/`.
- **API** numa função da Vercel (`api/index.js`).
- **Base de dados PostgreSQL** na Neon, criada a partir do separador Storage da Vercel. Tem 18 tabelas: contas, catálogo, reservas, carteira, favoritos, avaliações, notificações, lembretes, suporte e imagens.
- **Sem dependências npm**: o cliente Postgres está incluído (`src/pg.js`), por isso a publicação não precisa de instalar nada.
- **A base de dados cria-se sozinha.** Na primeira visita ao site, a API cria todas as tabelas e carrega o catálogo inicial e a conta de administrador.

---

## Angola 365º (v3.4): mapa oficial, ENDA AI e pesquisa diária

**Mapa oficial.** O shapefile `Angola_Level2` (21 províncias, 326 municípios, WGS84) está em `dados/angola-level2/`. O script `scripts/shp-para-geojson.js` gera:
- `src/geo/municipios.json`: limites usados pelo servidor para saber em que município fica cada ponto (`src/geo.js`).
- `public/geo/angola-municipios.geojson`: versão simplificada desenhada no ecrã «Mapa de Angola» (SVG, sem bibliotecas externas).

**Regras do mapa:**
- Coordenadas fora do mapa são recusadas no painel.
- O município e a província de cada destino, alojamento, restaurante, experiência e evento passam a ser os do mapa.
- A migração automática acerta os registos existentes.
- Pontos na costa até 6 km dos limites contam para o município mais próximo.

**ENDA AI** (`src/enda.js`, rota `POST /api/enda`):
- Conversa através do Vercel AI Gateway, com ferramentas que só lêem dados da plataforma: catálogo, perto de mim, eventos, jogos, pratos, moradas OSM, como chegar e roteiros.
- O âmbito (turismo em Angola) é imposto no servidor; os pedidos fora do âmbito ficam registados no painel.
- Sem credencial de IA responde em modo básico.
- No navegador há voz contínua com máquina de estados: INACTIVE, REQUESTING_PERMISSION, LISTENING, PROCESSING, SPEAKING, PAUSED, ERROR e TERMINATING.

**Pesquisa diária** (`src/pesquisa.js`, tarefa `/api/cron/pesquisa` às 06:00 UTC):
- Fontes: agenda pública do VerAngola (2 páginas), Ticket.ao, Eventus.ao e notícias (RSS do Google Notícias).
- A IA extrai os eventos; cada um fica com a ligação de origem e o grau de confiança: fonte identificada, notícia ou rumor.
- O que não aparece no texto é descartado, tal como datas inválidas ou passadas.
- O robots.txt de cada site é respeitado.
- Rumores e notícias aparecem marcados e não vendem bilhetes.

**Futebol:**
- Calendário e resultados da Rádio 5 (RNA), sincronizados às 05:30 UTC, com histórico de alterações e deduplicação.
- Jogos da Selecção a partir da FAF (inseridos à mão).
- Estádios com coordenadas.

**Novas variáveis (opcionais):**
- `AI_GATEWAY_API_KEY`: só se o OIDC da Vercel não estiver activo.
- `ENDA_MODELO` e `PESQUISA_MODELO`: escolhem o modelo; por omissão é escolhido um modelo rápido da lista do AI Gateway.
- `CRON_SECRET`: protege as tarefas agendadas.
- `ENDA_LIMITE`: perguntas por utilizador a cada 10 minutos (por omissão 40).

## Publicar na Vercel com a base de dados (passo a passo)

### 1. Pôr o código na Vercel

Escolha **uma** das duas formas:

- **Com GitHub (recomendado):** envie esta pasta para um repositório no GitHub. Depois, na Vercel, vá a **Add New… → Project → Import** e escolha o repositório. Em *Framework Preset* deixe **Other**. Não altere mais nada e carregue em **Deploy**.
- **Sem GitHub:** no computador, dentro desta pasta, corra `npx vercel` e responda às perguntas. Para publicar em produção corra `npx vercel --prod`.

Se o projeto antigo `turismo-digital-360` já existe na Vercel, pode usar esse mesmo projeto. Basta substituir o código pelo desta pasta.

### 2. Criar a base de dados

1. Abra o projeto na Vercel e vá ao separador **Storage**.
2. Carregue em **Create Database** e escolha **Neon** (Serverless Postgres). Aceite a instalação da integração.
3. Região: escolha **Frankfurt (eu-central-1)**. É a mais próxima de Angola e é a mesma das funções deste projeto (`fra1` em `vercel.json`).
4. Plano: **Free** chega para começar.
5. No fim, carregue em **Connect Project**, escolha este projeto e deixe marcados *Production*, *Preview* e *Development*.

A Vercel cria sozinha a variável `DATABASE_URL`. O código também aceita `POSTGRES_URL`.

### 3. Variáveis de ambiente

Em **Settings → Environment Variables**, acrescente estas variáveis **antes** da primeira visita ao site:

| Variável | Valor | Para quê |
|---|---|---|
| `ADMIN_EMAIL` | o seu e-mail | Conta de administrador criada na primeira visita |
| `ADMIN_PASSWORD` | uma senha forte | Senha dessa conta (sem isto fica `admin360`) |
| `SEED_DEMO` | `0` | Opcional: não cria clientes e reservas de demonstração |
| `CRON_SECRET` | um texto aleatório comprido | Protege a tarefa diária dos lembretes |

### 4. Voltar a publicar e abrir o site

Vá a **Deployments**, abra os três pontos do último deploy e escolha **Redeploy**. Isto faz o deploy apanhar as variáveis novas.

Depois abra o site. A primeira visita demora alguns segundos, porque é nesse momento que a base de dados é criada. Para confirmar que ficou ligada, abra `https://O-SEU-SITE.vercel.app/api/saude`: deve aparecer `"ok": true` e a versão do PostgreSQL.

O painel fica em `https://O-SEU-SITE.vercel.app/admin/`.

### Alternativa: criar as tabelas à mão

No painel da Neon (Storage → a base de dados → **Open in Neon** → **SQL Editor**), cole o conteúdo de `database/schema.sql` e execute. Isto cria só as tabelas. O catálogo e a conta de administrador são carregados na primeira visita ao site, desde que a tabela `utilizadores` esteja vazia.

---

## Contas iniciais

| Conta | E-mail | Senha |
|---|---|---|
| Administrador | `ADMIN_EMAIL` (por omissão `admin@turismo360.ao`) | `ADMIN_PASSWORD` (por omissão `admin360`) |
| Cliente de demonstração (se `SEED_DEMO` ≠ 0) | `visitante@turismo360.ao` | `angola360` |

## Correr no computador

Precisa do Node.js 20 ou mais recente e de uma ligação Postgres. A forma mais simples é usar a mesma base de dados da Vercel:

```bash
npx vercel env pull .env.local     # copia DATABASE_URL da Vercel
npm start                          # http://localhost:3000  e  /admin/
```

Também pode criar um ficheiro `.env` a partir do `.env.example`, com qualquer `DATABASE_URL`.

| Comando | O que faz |
|---|---|
| `npm start` / `npm run dev` | Servidor local (o `dev` reinicia sozinho quando altera o código) |
| `npm run seed` | Cria as tabelas e os dados iniciais numa base de dados vazia |
| `npm run seed -- --apagar` | **Apaga tudo** e recria. Cuidado em produção! |
| `TEST_DATABASE_URL=… npm test` | Corre 22 testes automáticos numa base de dados temporária |

## Estrutura

```
api/index.js           função da Vercel (todas as rotas /api/*)
vercel.json            configuração: pasta pública, rotas, região, tarefa diária
server.js              servidor local (não é usado na Vercel)
src/app.js             tratamento dos pedidos + criação automática da base de dados
src/api.js             rotas da API
src/pg.js              cliente PostgreSQL sem dependências (SSL, SCRAM, pool)
src/db.js              ligação, transacções, cifra de senhas
src/semear.js          catálogo inicial e contas de demonstração
src/recursos.js        definição do catálogo (API e formulários do painel)
database/schema.sql    esquema completo (pode colar no SQL Editor da Neon)
public/                site do turista e painel de administração
tests/api.test.js      testes automáticos
```

## Línguas (PT · EN · FR · ES)

- O visitante escolhe a língua no seletor (ecrã de entrada, barra lateral, topo da página inicial no telemóvel e Perfil). Na primeira visita é usada a língua do navegador.
- A interface é traduzida por `public/js/i18n.js` com o dicionário `public/js/i18n-dic.js` (linhas `[português, inglês, francês, espanhol]`). Para traduzir uma frase nova, acrescente uma linha.
- O conteúdo do catálogo vem traduzido da API (`/api/catalogo?lang=en`). Cada item tem um campo **Traduções** no painel; o catálogo inicial já vem traduzido (`src/traducoes.js`).
- A Kianda responde, fala e ouve na língua escolhida e percebe pedidos em português, inglês, francês e espanhol.
- O painel de administração continua em português.

## Entrar com Google, Facebook ou Microsoft

- Os botões estão no ecrã de entrada e de registo. A conta é criada na primeira entrada; se já existir uma conta com o mesmo e-mail verificado (Google, Facebook), fica ligada a ela. A Apple foi retirada (exige conta Apple Developer paga).
- **Google:** activo. Cliente OAuth «Turismo Digital 360 - Web» no Google Cloud (projecto «My First Project», conta anmarques6@gmail.com), publicado em produção. As chaves estão nas variáveis da Vercel.
- Cada fornecedor fica activo quando as suas variáveis estão definidas na Vercel (ver `.env.example`) e o site é publicado de novo.
- No painel, **Sistema → Entrada com redes sociais** mostra o estado de cada fornecedor, os passos e o endereço de redirecionamento a copiar.
- Quem entra com uma rede social pode, no Perfil, definir uma senha para entrar também com o e-mail.

## Segurança da sessão

- A sessão termina ao fim de **1 minuto sem actividade** (`SESSAO_INATIVIDADE_S`, por omissão 60), no site e no painel; aos 45 s aparece um aviso.
- 5 senhas erradas seguidas bloqueiam a conta 15 minutos. Senhas novas: mínimo 8 caracteres, com letras e números. Duração máxima de uma sessão: 12 horas.
- Na entrada com redes sociais, o site recebe um código de uso único (60 s) em vez do token.
- Cabeçalhos de segurança (CSP, HSTS, X-Frame-Options, Permissions-Policy) em `vercel.json`.
- Páginas públicas: `/privacidade.html` e `/termos.html` (exigidas pelo Google e pelo Facebook).

## Actualizações da base de dados

Ao arrancar, a API verifica se a base de dados tem a versão mais recente do esquema. Se não tiver, aplica `database/schema.sql` (idempotente) e grava as traduções iniciais. Não é preciso correr nada à mão.

## Regras de negócio

- **Preços** são sempre calculados no servidor. Os descontos de alojamento são aplicados automaticamente.
- **Carteira 360**: o débito é imediato e garantido pela base de dados. Mesmo com pedidos em simultâneo, nunca se gasta mais do que o saldo.
- **Multicaixa Express**: a reserva fica *pendente* até a equipa marcar "Pago" no painel.
- **Pontos 360**: 1 ponto por cada 100 Kz. São retirados se a reserva for cancelada.
- **Cancelamento**: o cliente pode cancelar até à véspera e o valor volta à carteira.
- **Eventos**: a lotação é controlada. **Viaturas**: as unidades livres são controladas por datas.
- **Lembretes da Kianda**: são entregues quando o cliente abre a app e também pela tarefa diária da Vercel (`/api/cron/lembretes`, às 08:00 UTC).
- **Imagens carregadas no painel** ficam guardadas na base de dados (máx. 3 MB cada), porque a Vercel não guarda ficheiros.
- **Apagar no painel** um item que tem reservas não o apaga: só o despublica.

## O que ainda é simulado

- **Pagamentos reais** (EMIS / Multicaixa Express, Unitel Money, cartão). O ponto de integração está assinalado em `src/api.js`.
- **Recuperação de senha por e-mail**: o botão indica o contacto do suporte.
- **A Kianda** responde com regras e com o catálogo da base de dados, sem custos de IA.
