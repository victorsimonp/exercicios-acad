# Hypertrophy Tracker

Plataforma de treinamento com React/TypeScript, Fastify, Prisma e **PostgreSQL gerenciado pelo Supabase**. A autenticação utiliza Supabase Auth. O backend continua responsável por prescrição, sessões, progressão, métricas e auditoria.

## Executar nesta máquina

Os arquivos de ambiente locais já foram configurados para o projeto Supabase `exercicios-acad`. Na raiz do repositório:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd db:generate
pnpm.cmd dev
```

- Aplicação: http://localhost:5173
- API: http://localhost:3333/api/v1
- Documentação OpenAPI: http://localhost:3333/docs
- Verificação do banco e contexto RLS: `pnpm.cmd db:check`

O Docker **não é necessário para executar a aplicação com Supabase**. Ele permanece disponível para o banco antigo e para os testes locais. Para iniciar separadamente: `pnpm.cmd --filter @ht/api dev` e `pnpm.cmd --filter @ht/web dev`.

## Primeiro acesso após a migração

O perfil e os dados antigos foram preservados, mas **a senha e os cookies antigos não são reutilizados**. Na tela inicial, escolha **Criar conta**, informe o **mesmo email da conta antiga**, defina uma senha e confirme o email enviado pelo Supabase. Ao entrar com o email confirmado, o backend vincula o perfil existente e mantém seus programas e sessões; não cria um segundo perfil para o mesmo email.

Para um email novo, o primeiro acesso autenticado cria um perfil e o programa inicial de oito semanas. A senha nunca é gravada pelas tabelas da aplicação. O campo legado `passwordHash` foi mantido apenas para compatibilidade de schema e está vazio no banco remoto; `AuthSession` permanece bloqueada e vazia.

### URLs dos emails de autenticação

No painel Supabase, acesse **Authentication → URL Configuration**:

- **Site URL:** `https://treinos-acad.vercel.app`
- **Redirect URLs:** `https://treinos-acad.vercel.app/auth/callback` e `https://treinos-acad.vercel.app/auth/redefinir-senha`
- Para desenvolvimento, adicione também `http://localhost:5173/auth/callback` e `http://localhost:5173/auth/redefinir-senha` à lista de redirects, mantendo a Site URL de produção.

Painel do projeto atual: https://supabase.com/dashboard/project/exvcchwfftfafaovkydj/auth/url-configuration

O MCP disponível não oferece uma operação para alterar essa configuração; aplique-a no painel. O cadastro já envia a origem atual do navegador com o caminho `/auth/callback`; esse endereço precisa estar permitido no Supabase. Atualize também `WEB_ORIGIN` na API para o domínio de produção. Mantenha a confirmação de email habilitada: ela protege o vínculo do perfil importado. Para recuperação, use **Esqueci minha senha** e abra o link no mesmo navegador da solicitação (fluxo PKCE).

Em **Authentication → Email Templates → Confirm signup**, defina o assunto como **Confirme seu email | Hypertrophy Tracker** e cole o conteúdo de [`supabase/templates/confirmation.html`](supabase/templates/confirmation.html) no corpo HTML. O template usa as cores do site e `{{ .ConfirmationURL }}` para preservar a verificação do token e o redirect do Supabase. Salvar o arquivo no repositório não publica o template no serviço hospedado.

Depois de salvar as configurações, faça um novo cadastro pelo site publicado e abra o novo email no mesmo navegador. Confira o visual e o retorno para `https://treinos-acad.vercel.app/auth/callback`, seguido da entrada na aplicação. Links de emails antigos podem continuar apontando para localhost; solicite um novo email. Os detalhes e o comportamento de fallback estão na [documentação de redirects](https://supabase.com/docs/guides/auth/redirect-urls) e as variáveis na [documentação de templates](https://supabase.com/docs/guides/auth/auth-email-templates).

## Variáveis de ambiente

Na Vercel, o frontend também aceita `API_URL`, `SUPABASE_URL` e
`SUPABASE_PUBLISHABLE_KEY`, sem prefixo. Esses nomes têm prioridade sobre os
equivalentes `VITE_*`, que continuam funcionando localmente. O Vite inclui apenas
esses três valores públicos no navegador. Depois de alterá-los, faça um novo
deploy; localmente, reinicie o Vite. Não coloque conexões PostgreSQL ou chaves
administrativas no ambiente do frontend.

Em outra máquina, copie os exemplos e preencha os ambientes localmente, sem enviar segredos pelo chat:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

| Ambiente | Variável                        | Uso                                                                           |
| -------- | ------------------------------- | ----------------------------------------------------------------------------- |
| API      | `DATABASE_URL`                  | Login `ht_runtime`, usado pelo Fastify; não tem bypass de RLS                 |
| API      | `DIRECT_URL`                    | Login `ht_migrator`, usado por migrations, seed e ferramentas administrativas |
| API      | `SUPABASE_URL`                  | URL pública do projeto Supabase                                               |
| API      | `SUPABASE_PUBLISHABLE_KEY`      | Chave publicável para validar tokens com Supabase Auth                        |
| API      | `DATABASE_POOL_MAX`             | Máximo do pool; padrão 5                                                      |
| API      | `PORT`, `HOST`, `WEB_ORIGIN`    | Padrões 3333, 127.0.0.1 e http://localhost:5173                               |
| Web      | `VITE_API_URL`                  | URL pública da API; local: http://localhost:3333                              |
| Web      | `VITE_SUPABASE_URL`             | URL pública do projeto Supabase                                               |
| Web      | `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave `sb_publishable_...`, permitida no navegador                            |

O frontend valida a configuração e informa variáveis ausentes. Nunca coloque senha do PostgreSQL, `DIRECT_URL`, chave secret ou service-role em variáveis `VITE_*`. **Nenhuma chave administrativa do Supabase é necessária para esta aplicação.**

As conexões PostgreSQL usam Session Pooler na porta 5432 e TLS `verify-full`, com a CA oficial em `certs/supabase-ca.crt`. A URL usa `sslrootcert=../../certs/supabase-ca.crt`, relativa ao workspace `apps/api`, de onde os scripts são executados. Em outro servidor, preserve esse caminho ou ajuste o certificado. Não desative a validação TLS.

## Arquitetura

```text
React → Supabase Auth → sessão PKCE e renovação do token
React → Bearer token → Fastify → auth.getUser(token)
Fastify → transação Prisma → SET LOCAL ROLE ht_api
                          → identidade verificada no contexto JWT
                          → políticas RLS → PostgreSQL Supabase
```

O cliente Supabase do navegador cuida de cadastro, login, logout, confirmação e recuperação de senha. A API não aceita IDs de usuário enviados pelo cliente como identidade. Ela valida o token no Supabase Auth, exige email confirmado e rejeita usuários anônimos. Metadados editáveis pelo usuário servem apenas ao nome de exibição, nunca à autorização.

Cada requisição autenticada utiliza uma transação com papel `ht_api` e contexto definido por `SET LOCAL`. O contexto não permanece no pool após a transação. AsyncLocalStorage encaminha as consultas e transações dos módulos existentes para essa mesma conexão. O retorno só é enviado depois do commit; falhas desfazem a requisição.

### Perfis e RLS

`User.authUserId` é único e, no Supabase, referencia `auth.users(id)`. Os IDs antigos da aplicação foram mantidos para preservar os relacionamentos. Um perfil importado sem vínculo só pode ser reivindicado pelo backend após validação do mesmo email confirmado; a função fica no schema privado, sem execução para `anon` ou `authenticated`.

Todas as tabelas públicas, inclusive as técnicas, têm RLS habilitada e forçada. Programas, fichas, sessões, séries, recomendações e logs validam o proprietário; tabelas filhas seguem o relacionamento até o recurso do usuário. Referências a exercícios ou pais de terceiros são bloqueadas. Clientes autenticados podem consultar os dados permitidos, mas operações de negócio continuam pela API, com as validações e a auditoria existentes. O catálogo global é somente leitura para os clientes; exercícios personalizados pertencem ao criador.

Papéis separados: `ht_runtime` não tem bypass; `ht_api` não tem login; `ht_migrator` possui bypass exclusivamente para administração/importação. A API não utiliza o migrador para atender requisições. Veja `docs/supabase-access.md`. O provisionador temporário de credenciais foi removido do banco.

## Estrutura

```text
apps/api/prisma/schema.prisma       Modelos Prisma e índices
apps/api/prisma/migrations/         Histórico canônico de migrations SQL
apps/api/src/modules/auth.ts        Bearer e proteção das rotas
apps/api/src/modules/supabase.ts    Validação no Supabase Auth
apps/api/src/modules/profile.ts     Vínculo do perfil e programa inicial
apps/api/src/db.ts                  Pool, transação e contexto RLS
apps/api/src/modules/               Treinos, sessões, periodização e analytics
apps/api/src/testing/               Suporte de testes e transferência
apps/web/src/lib/supabase.ts        Cliente Supabase e validação de ambiente
apps/web/src/pages/auth-callback.tsx Confirmação e redefinição de senha
apps/web/src/pages/                 Páginas de treinamento
apps/web/src/components/            Editor, registro de séries, agenda e timer
packages/shared/src/index.ts        Tipos compartilhados
certs/supabase-ca.crt               CA pública oficial do PostgreSQL
```

## Migrations e seed

Prisma foi mantido. As migrations anteriores continuam intactas; as novas adicionam identidade, políticas RLS, grants e índices. O histórico do Prisma remoto foi alinhado às migrations aplicadas pelo MCP, com seus checksums.

```powershell
pnpm.cmd --filter @ht/api exec prisma migrate status
pnpm.cmd --filter @ht/api exec prisma migrate deploy
pnpm.cmd db:generate
pnpm.cmd db:seed
```

`migrate deploy` utiliza `DIRECT_URL`. **Não use `migrate dev`, `db push`, reset ou comandos de limpeza no projeto remoto.** Desenvolva e teste novas migrations no PostgreSQL local, revise o SQL e só então aplique na nuvem. O seed é idempotente, não preenche cargas e não sobrescreve exercícios existentes. Em um ambiente já importado, não é necessário executá-lo para iniciar a API. O catálogo é uma etapa administrativa, não uma escrita privilegiada a cada inicialização do servidor.

Em novas instalações Supabase, os papéis de conexão precisam ser provisionados antes das migrations. Gere senhas aleatórias e armazene-as no ambiente; nunca reutilize uma credencial de cliente como credencial administrativa. As configurações de Auth e as tabelas do schema `auth` continuam sob gestão do Supabase.

## Dados migrados e rollback

A transferência foi transacional e validada por contagem e SHA-256 do conteúdo normalizado das 14 tabelas de dados. Foram preservados:

- 1 perfil, 3 programas e 24 semanas;
- 24 fichas, 96 prescrições e 32 exercícios;
- 1 sessão, 4 exercícios de sessão e 11 séries;
- 13 grupos musculares e 2 registros de auditoria.

`AuthSession` e os hashes de senha não foram transferidos. Os dados de execução e as cópias de prescrição não foram modificados.

O backup completo está em `.backups/before-supabase-*.dump`; o relatório de comparação está em `.backups/supabase-transfer-report.json`. Ambos são locais, ignorados pelo Git e contêm informações privadas: proteja-os como os demais dados pessoais.

O volume Docker antigo foi preservado. `.env.local-before-supabase` guarda a conexão anterior. Para recuperar o ambiente antigo, é preciso usar também o código anterior à migração de autenticação; trocar apenas a URL não restaura o login antigo. Antes de qualquer rollback, exporte os registros novos criados no Supabase. Não remova o volume antigo antes de confirmar seu acesso aos dados migrados.

## Testes

Os testes de integração verificam PostgreSQL e RLS reais **localmente**, com o verificador de identidade simulado. Um bloqueio explícito impede executar essa suíte contra um banco remoto.

Nesta máquina, `apps/api/.env.test` já está separado do ambiente principal. Em outra máquina:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.test.example apps/api/.env.test
Copy-Item apps/web/.env.test.local.example apps/web/.env.test.local
pnpm.cmd db:up
```

Configure a senha do banco local nos arquivos do Docker e em `apps/api/.env.test`. Nesse arquivo, tanto `DATABASE_URL` quanto `DIRECT_URL` devem apontar para localhost. Aplique as migrations locais:

```powershell
pnpm.cmd --filter @ht/api exec node --env-file=.env.test node_modules/prisma/build/index.js migrate deploy
pnpm.cmd test
pnpm.cmd test:e2e
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd build
```

Os testes E2E usam API em localhost:3334, frontend em localhost:5174 e um provedor de identidade simulado em localhost:54321. Esse servidor só inicia com `NODE_ENV=test` e conexão PostgreSQL local. O servidor de produção nunca importa essa simulação. Os testes cobrem desktop e Pixel 7, registro e recuperação de séries, histórico, edição, reordenação, agenda e periodização.

**Não foram criadas contas de teste no Supabase**, conforme solicitado. O login real com email confirmado e a entrega dos emails precisam ser validados usando sua própria conta. Testes de componentes verificam que cadastro, login e recuperação chamam os métodos corretos do cliente Supabase; isso não substitui a confirmação de entrega dos emails.

### Verificações da migração

- Contagens e checksums da transferência conferidos.
- Conexão PostgreSQL remota com TLS e contexto RLS validada.
- Supabase Auth respondeu HTTP 200; email habilitado, cadastro permitido e confirmação exigida.
- Consultas remotas sob duas identidades de diagnóstico não enxergaram registros privados; o catálogo global permaneceu disponível.
- Testes locais tentam consultas sem filtro de proprietário, escrita cruzada, troca de dono e acesso a tabelas filhas; essas tentativas são bloqueadas.
- 39 testes de regras/API/autenticação e 6 testes de componentes passaram; os 4 E2E locais passaram.
- O verificador de segurança do Supabase foi executado; o resultado final fica no resumo da entrega.

## Endpoints e funcionalidades preservadas

A API usa `/api/v1`. Os endpoints de negócio continuam com os mesmos caminhos: `/exercises`, `/muscles`, `/programs`, `/workouts`, `/periodization`, `/sessions`, `/schedules`, `/analytics`, `/progression/recommendations` e `/audit`. `/auth/me` permanece para consultar/editar o perfil. Cadastro, login, logout e recuperação agora são feitos diretamente no Supabase Auth; as antigas rotas de senha/cookie foram retiradas. `/docs` documenta a API e aceita token Bearer.

Continuam disponíveis: fichas A/B, ciclo editável, deload, criação e edição de treinos, substituição e reordenação de exercícios, registro progressivo de carga/repetições/RIR, rascunho temporário, cronômetro por timestamp, histórico, comparação e CSV, gráficos, volume direto/secundário, sugestões de progressão e agenda.

Semanas 1–2 usam duas séries, 3–7 o alvo individual, e a semana 8 usa uma série com 3–4 RIR para deload. Preparatórias não contam como séries efetivas. Cargas no PostgreSQL usam `Decimal`; `null` é ausência de registro, e zero é uma carga válida.

Volume = carga normalizada × repetições de séries de trabalho concluídas. Carga por lado/halter é multiplicada por dois; por lado exclui a barra. Use base total para outra convenção/unilateralidade. Gráficos separam as bases. A métrica não mede diretamente estímulo hipertrófico e não deve comparar exercícios distintos. Progressão exige todas as séries completas, técnica adequada, topo da faixa e RIR na meta; sugestões não alteram automaticamente as cargas.

## Erros comuns

- **Variáveis Supabase ausentes:** preencha os exemplos e reinicie Vite/API; variáveis `VITE_*` entram no build.
- **Senha antiga não entra:** crie o acesso Supabase com o mesmo email e confirme-o. O perfil antigo será vinculado após autenticação verificada.
- **Email abre outra porta/domínio:** revise Site URL e Redirect URLs no painel Auth.
- **Link expirado ou sem sessão PKCE:** solicite outro e use o mesmo navegador da solicitação.
- **`SELF_SIGNED_CERT_IN_CHAIN`:** confira a CA oficial e o parâmetro `sslrootcert`; mantenha `verify-full`.
- **Conexão direta IPv6 falha:** use o Session Pooler do painel Connect, com usuário `papel.PROJECT_REF` e porta 5432.
- **403 de origem:** `WEB_ORIGIN` deve ser a origem exata do frontend.
- **RLS retorna vazio:** confira o token Bearer, a confirmação do email e o vínculo `authUserId`; nunca resolva isso desativando RLS.
- **Testes recusam banco remoto:** configure `.env.test` com os dois URLs locais. Não remova a proteção.

## Produção e limitação do catálogo

O build gera `apps/web/dist` e `apps/api/dist`. Inicie a API compilada com `pnpm.cmd --filter @ht/api start`. Para hospedar, configure os ambientes do frontend/API, a CA, origem permitida e URLs do Supabase Auth; o frontend precisa de fallback para `index.html`. Nenhuma publicação na Vercel ou no Render foi realizada nesta migração.

O PDF “Protocolo de Treino — Victor Simon Paulo.pdf” continua indisponível. O catálogo inicial mantém somente os 32 exercícios fornecidos na solicitação, com os nomes preservados. A importação do catálogo completo aguarda esse documento.
