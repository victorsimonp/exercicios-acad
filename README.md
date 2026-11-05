# Hypertrophy Tracker

Plataforma local funcional de treinamento com React/TypeScript, API Fastify e persistência PostgreSQL via Prisma. Não usa resultados demonstrativos como dados do usuário.

## Iniciar

Requisitos: Node.js 24 LTS, pnpm 10, Docker Desktop com Linux containers. No PowerShell, dentro desta pasta:

```powershell
pnpm.cmd install
pnpm.cmd db:up
pnpm.cmd db:generate
pnpm.cmd --filter @ht/api exec prisma migrate deploy
pnpm.cmd db:seed
pnpm.cmd dev
```

Acesse **http://localhost:5173**, clique em **Criar conta** e cadastre nome, email e senha com pelo menos 10 caracteres. O cadastro cria seu programa de oito semanas, com oito fichas A/B, quatro dias por foco e os 32 exercícios originais. As cargas começam vazias. Não existe conta ou senha padrão.

- Frontend: http://localhost:5173
- API: http://localhost:3333/api/v1
- Swagger/OpenAPI: http://localhost:3333/docs e http://localhost:3333/docs/json
- Saúde da API: http://localhost:3333/api/v1/health
- Conexão PostgreSQL: `pnpm.cmd db:check`

`Ctrl+C` encerra frontend e API. `pnpm.cmd db:stop` para o banco preservando os dados. `docker compose ps` verifica o serviço. Evite `docker compose down -v`, que remove o volume do banco.

Para iniciar separadamente, use `pnpm.cmd --filter @ht/api dev` e `pnpm.cmd --filter @ht/web dev`, em terminais diferentes.

## Configuração de ambiente

Os arquivos locais existentes são ignorados pelo Git. Em outra máquina, copie os exemplos:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

| Arquivo         | Variável                                            | Finalidade                                                      |
| --------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| `.env`          | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Inicialização do container PostgreSQL                           |
| `apps/api/.env` | `DATABASE_URL`                                      | Conexão PostgreSQL; use a mesma senha configurada no Docker     |
| `apps/api/.env` | `PORT`                                              | Porta da API; padrão 3333                                       |
| `apps/api/.env` | `HOST`                                              | Interface da API; padrão 127.0.0.1                              |
| `apps/api/.env` | `WEB_ORIGIN`                                        | Origem exata permitida pelo CORS; padrão http://localhost:5173  |
| `apps/api/.env` | `NODE_ENV`                                          | `production` ativa cookies Secure; desenvolvimento pode omitir  |
| `apps/web/.env` | `VITE_API_URL`                                      | URL pública da API, sem `/api/v1`; padrão http://localhost:3333 |

Segredos ficam apenas no backend e no ambiente Docker. Nunca inclua credenciais em `VITE_*`. Alterar a senha do `.env` não altera uma senha já inicializada no volume do PostgreSQL. Reinicie os servidores após mudar o ambiente.

## Arquitetura e pastas

```text
apps/
  api/
    prisma/schema.prisma          Entidades e relacionamentos
    prisma/migrations/            Migrations versionadas
    src/modules/
      auth.ts                     Contas, cookies e autenticação
      exercises.ts                Catálogo e metadados
      programs.ts                 Ciclos, fichas e edição de prescrição
      sessions.ts                 Execução, cópias históricas e auditoria
      schedules.ts                Agenda e reagendamentos
      analytics.ts                Métricas e sugestões
      training.ts                 Regras puras de volume/periodização/progressão
      seed.ts                     Catálogo e criação do programa inicial
      schemas.ts                  Validações Zod
      docs.ts                     Contratos da documentação OpenAPI
      initial-exercises.json      Transcrição dos 32 exercícios do documento
    src/testing/                  Limpeza isolada das contas de teste
    src/*.test.ts                 Integração com PostgreSQL real
  web/
    src/app/                      Contexto de conta, navegação e layout
    src/pages/                    Dashboard, fichas, execução, catálogo,
                                  periodização, histórico, evolução e preferências
    src/components/               Editor, séries, cronômetro, agenda e UI
    src/lib/                      Utilitários e validação de séries
    src/services/                 Cliente HTTP autenticado
    e2e/                          Fluxos reais em desktop e celular
packages/shared/src/index.ts      Tipos de contratos compartilhados
```

Frontend: React 19, TypeScript strict, Vite, Tailwind, base shadcn/ui, React Router, TanStack Query, React Hook Form, Zod, Recharts e Lucide. Estado de servidor fica no TanStack Query; contexto React cobre conta e semana selecionada, sem necessidade de Zustand.

Backend: Fastify, TypeScript strict, Prisma 7 com adapter PostgreSQL, Zod, cookies HttpOnly, rate limiting, CORS e Swagger. Senhas usam scrypt com salt aleatório; tokens de sessão são aleatórios e somente seu hash fica no banco. A sessão de autenticação expira em 30 dias. Todas as operações persistentes passam pela API e consultas de recursos privados verificam o proprietário.

## Funcionalidades

- Dashboard com semana/foco, próximo treino, séries, volume, duração média, atividades e recordes reais.
- Fichas A/B fiéis aos nomes, séries-alvo, repetições e faixas de descanso fornecidos.
- Ciclo editável de 1–52 semanas, alternância A/B, séries fixas ou individuais, RIR e deload; duplicação, reinício e arquivamento sem apagar sessões.
- Treinos personalizados; adição, remoção, substituição e edição de exercícios. Reordenação por arrastar ou botões acessíveis.
- Edição do modelo, sobreposição para futuras sessões e edição apenas da sessão iniciada. Mudanças de modelo não alteram sessões existentes.
- Catálogo com busca sem acentos na API, filtros por grupo, região, equipamento e movimento; detalhes, cópias personalizadas e desativação lógica.
- Séries de aquecimento, aproximação e trabalho separadas; aquecimento pode ser pulado com confirmação persistida. Preparatórias não entram no volume efetivo.
- Registro progressivo de carga, repetições, RIR, técnica, conclusão e notas. Salvamento automático com rascunho local e feedback de falha, sem tratar rascunhos como histórico definitivo.
- Sessões pausáveis e recuperáveis após recarga. Criação idempotente; revisão de série e transação com trava por sessão evitam sobrescritas concorrentes.
- Descanso baseado em timestamp, com ajuste de tempo, pausa, retomada, reinício e indicação de término. O fim previsto fica na API; a pausa do cronômetro usa cache local.
- Histórico paginado com filtros, detalhes, comparação de duas sessões, correções auditadas e exportação CSV de todas as páginas do filtro.
- Gráficos de carga por exercício e base, séries musculares diretas e participação secundária estimada, volume A/B e calendário.
- Agenda com agendamento, datas anteriores de reagendamentos, cancelamento, indicação de treinos não realizados e vínculo com a sessão. A adesão usa agendamentos vencidos não cancelados, sem presumir faltas quando não há planejamento.
- Sugestões de progressão dupla com justificativa persistida; aceitar, editar ou ignorar sem aplicar cargas automaticamente.
- Tema escuro/claro, layout responsivo, navegação inferior no celular, labels e navegação de teclado nos diálogos.

## Regras de dados

As semanas 1–2 usam duas séries por exercício; 3–7 usam o alvo individual; a semana 8 usa uma série e 3–4 RIR para deload, dentro da faixa de 1–2 séries solicitada. Volume, foco e RIR são configuráveis. Nas semanas com volume-alvo, RIR individual da ficha vale sob a meta padrão 1–2; outra faixa semanal substitui essa meta. Semana de deload nunca gera aumento sugerido.

Cada sessão guarda nome, grupo principal, estimativas secundárias, foco, semana, prescrição e base de carga. Trocar ou remover exercícios da ficha não altera essas cópias. Alterações de séries têm revisões e auditoria consultável por proprietário em `/api/v1/audit/:id`. Correções de sessões concluídas recalculam as sugestões, invalidando decisões anteriores sobre a sugestão antiga.

RIR é **informado pelo usuário**, não calculado a partir da carga: 0 significa falha técnica, 2 significa estimar mais duas repetições possíveis. Valores aceitos: inteiros de 0 a 10. Concluir uma série exige carga não negativa, repetições positivas e RIR. Carga zero é válida; ausência de carga é `null`.

Cargas usam `Decimal(10,3)` no PostgreSQL; respostas JSON as representam como strings. Valores de entrada da API são números em kg. Bases:

- `total`: peso total, incluindo a barra quando aplicável.
- `per_side`: peso de cada lado, excluindo a barra; métrica normalizada multiplica por dois.
- `per_dumbbell`: peso de cada halter; métrica normalizada multiplica por dois.

Para movimento unilateral ou equipamento com outra convenção, escolha **total** e registre a carga total daquela série. A base pode ser alterada em cada registro; gráficos e recordes separam as bases. Séries com bases ou cargas diferentes não geram sugestão de aumento conjunta.

Volume de carga = soma de carga normalizada × repetições **das séries de trabalho concluídas**. Essa métrica não mede diretamente estímulo hipertrófico e não deve comparar exercícios diferentes. Participações secundárias são estimativas configuráveis, separadas das séries diretas e preservadas na sessão; o seed não inventa ponderações biomecânicas.

Progressão exige todas as séries de trabalho completas, topo da faixa, RIR na meta e técnica adequada. O incremento disponível arredonda a sugestão; seu percentual final pode superar a referência. Dados insuficientes, séries incompletas, deload e metas não atingidas não geram aumento. As sugestões são opcionais.

## Endpoints

Todos com prefixo `/api/v1`, exceto Swagger. Consulte os corpos no `/docs`.

| Recurso          | Operações                                                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticação     | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `PATCH /auth/me`                                                               |
| Exercícios       | `GET/POST /exercises`, `GET/PATCH/DELETE /exercises/:id`                                                                                                       |
| Grupos           | `GET/POST /muscles`                                                                                                                                            |
| Programas        | `GET/POST /programs`, `GET/PATCH /programs/:id`, `POST /programs/:id/duplicate`, `/restart`, `/archive`                                                        |
| Treinos          | `GET/POST /workouts`, `GET/PATCH /workouts/:id`, `POST /workouts/:id/exercises`, `PATCH/DELETE /workouts/:id/exercises/:itemId`, `PATCH /workouts/:id/reorder` |
| Periodização     | `GET/PATCH /periodization/:programId`, `GET /periodization/:programId/current`                                                                                 |
| Sessões          | `POST/GET /sessions`, `GET/PATCH /sessions/:id`, `POST /sessions/:id/complete`, `POST /sessions/:id/sets`, `PATCH /sessions/:id/sets/:setId`                   |
| Edição de sessão | `PATCH /sessions/:id/exercises/:itemId`, `POST /sessions/:id/exercises/:itemId/skip-warmup`                                                                    |
| Agenda           | `GET/POST /schedules`, `PATCH /schedules/:id`                                                                                                                  |
| Analytics        | `GET /analytics/dashboard`, `/analytics/volume`, `/analytics/progression`, `/analytics/attendance`, `/analytics/exercises/:id`                                 |
| Progressão       | `GET /progression/recommendations`, `POST /progression/recommendations/:id/accept`, `/dismiss`                                                                 |
| Auditoria        | `GET /audit/:id` (ID da série ou item de prescrição)                                                                                                           |

Exercícios e sessões retornam `{ items, total, page, pageSize }`, com `pageSize` até 100. Exercícios aceitam `search` e `muscle` (ID do grupo). Sessões aceitam `focus`, `from`, `to`, `exerciseId`, `muscle` (nome histórico), `status`, `programId` e `weekNumber`. Analytics aceita `exerciseId`, `from` e `to`. Listas de programas pertencem à conta autenticada. A agenda retorna até 500 registros.

Use cookies com `credentials: include`. Requisições do navegador que alteram dados precisam da origem configurada. Há limite geral de 300 requisições/minuto por IP e de 10/minuto nas rotas de cadastro/login. Erros retornam `{ error: string }` com status 400, 401, 403, 404, 409, 429 ou 500 conforme o caso. Na série, envie a `revision` recebida; conflito retorna 409, preservando o rascunho para revisão.

## Verificações

Com PostgreSQL iniciado e migrations aplicadas:

```powershell
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd test
pnpm.cmd test:e2e
pnpm.cmd build
pnpm.cmd db:check
```

Validação desta entrega: **32 testes de regras/API**, **3 testes de componentes** e **4 testes E2E** (dois fluxos em desktop e celular) passaram. TypeScript strict, ESLint, build de produção e conexão PostgreSQL foram verificados; as quatro migrations estão aplicadas. A API compilada foi iniciada e respondeu saúde/documentação, bloqueando acesso anônimo aos programas com HTTP 401.

Os testes de integração usam PostgreSQL real e criam contas isoladas, removidas ao final. Para um banco exclusivo de teste, exporte `DATABASE_URL` antes de executar; aplique as migrations nele. Não há fallback para banco mockado.

Testes de navegador usam o Chrome instalado em `C:/Program Files/Google/Chrome/Application/chrome.exe`, nos tamanhos desktop e Pixel 7. Em outro ambiente, configure `CHROME_PATH` com o executável Chromium/Chrome. Playwright inicia e encerra os servidores necessários; capturas e traces ficam em `apps/web/test-results` e são ignorados pelo Git. A limpeza final remove exclusivamente as contas descartáveis `e2e-<UUID>@example.invalid` com nome `Atleta E2E`.

O build gera `apps/web/dist` e `apps/api/dist`. A API compilada inicia com `pnpm.cmd --filter @ht/api start`; o JSON do programa é copiado no build, sem depender de arquivos fonte em produção. O frontend estático exige fallback para `index.html`. Para publicar em produção, configure HTTPS, cookies Secure (`NODE_ENV=production`), frontend e API no mesmo site, origem permitida e banco com backups. Nenhuma publicação externa foi realizada nesta entrega local.

Para mudanças no banco, edite o schema, execute `pnpm.cmd --filter @ht/api exec prisma migrate dev --name nome_da_alteracao` e `pnpm.cmd db:generate`. O seed é idempotente e preserva alterações e cargas existentes.

## Limitação de fonte

**O PDF “Protocolo de Treino — Victor Simon Paulo.pdf” não está no repositório.** O catálogo inicial contém somente os 32 exercícios explicitamente listados no documento da solicitação, preservando seus nomes. A importação do catálogo completo aguarda esse PDF. Grupos e classificações da aplicação são metadados revisáveis; estimativas de participação secundária não são prescrições clínicas.
