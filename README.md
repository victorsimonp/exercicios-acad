# Hypertrophy Tracker

Base local de uma plataforma de treinos. Esta etapa prepara o ambiente; cadastros, treinos, periodização e gráficos ainda não foram implementados.

## Requisitos

Windows/PowerShell, Node.js 24 LTS, pnpm 10, Git e Docker Desktop com Linux containers. Não é necessário instalar PostgreSQL separadamente. Abra esta pasta no VS Code pelo menu **Arquivo > Abrir Pasta** ou execute `code C:\academia\hypertrophy-tracker`.

## Estrutura

- `apps/web`: interface React, Vite, Tailwind CSS, React Router e TanStack Query. `components.json`, aliases e componente Button preparam a utilização de shadcn/ui.
- `apps/api`: API Fastify com validação de ambiente por Zod e acesso PostgreSQL por Prisma.
- `packages/shared`: tipos compartilhados entre frontend e backend.
- `docker-compose.yml`: PostgreSQL 17, acessível somente em localhost, com volume persistente.

## Iniciar no PowerShell

Execute na pasta `C:\academia\hypertrophy-tracker`:

```powershell
pnpm.cmd install
pnpm.cmd db:up
pnpm.cmd db:generate
pnpm.cmd --filter @ht/api exec prisma migrate deploy
pnpm.cmd dev
```

O Docker Desktop precisa estar aberto. Acesse **http://localhost:5173**. O frontend consulta **http://localhost:3333/api/v1/health**, que retorna `{"status":"ok"}`. O indicador de API não verifica o banco: use `pnpm.cmd db:check` para isso.

`Ctrl+C` encerra frontend e API. Execute `pnpm.cmd dev` para reiniciar. `pnpm.cmd db:stop` para o banco preservando os dados. `docker compose ps` mostra os serviços e `docker compose logs postgres` mostra os logs. Não use `docker compose down -v` se quiser preservar os dados.

## Variáveis de ambiente

Na configuração inicial, os arquivos `.env` foram criados com uma senha local aleatória e ficam fora do Git. Para outra máquina, copie os exemplos:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

Substitua a senha de exemplo por uma senha local e use a mesma senha na `DATABASE_URL` de `apps/api/.env`. O arquivo raiz é utilizado pelo Docker Compose; o da API define porta, origem permitida e conexão; o da web define a URL pública da API. Nunca coloque segredos em variáveis `VITE_*`, pois elas são incluídas no navegador. Reinicie os servidores depois de editar o ambiente. Alterar a senha no `.env` não altera a senha de um banco já inicializado em um volume.

## Verificar e compilar

```powershell
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd test
pnpm.cmd build
pnpm.cmd db:check
```

O build gera `apps/web/dist` e `apps/api/dist`. Para executar a API compilada: `pnpm.cmd --filter @ht/api start`. A API carrega seu `.env` quando executada pelos scripts do workspace. O frontend exige hospedagem de arquivos estáticos com fallback para `index.html` se publicado futuramente.

Para alterações futuras do schema: edite `apps/api/prisma/schema.prisma`, execute `pnpm.cmd --filter @ht/api exec prisma migrate dev --name nome_da_alteracao` e depois `pnpm.cmd db:generate`. A tabela técnica `SetupCheck` valida a primeira migration sem introduzir funcionalidades de treino.

## Como as partes se comunicam

Uma API REST oferece endereços HTTP para consultar ou alterar recursos. O navegador executa o React, que envia uma requisição HTTP GET ao endpoint de saúde. O Fastify responde JSON e um código HTTP. Respostas fora da faixa de sucesso ou falhas de rede são mostradas na interface, com opção de tentar novamente. As requisições ficam centralizadas em `apps/web/src/services/api.ts`; TanStack Query gerencia o estado e a atualização. O CORS permite a origem local configurada. O PostgreSQL armazenará os dados persistentes e só é acessado pelo backend, através do Prisma.

## Git

O repositório local usa a branch `main`. `.env`, dependências, builds e cliente Prisma gerado são ignorados; exemplos, migrations e lockfile devem ser versionados. Nenhum repositório remoto é criado automaticamente. Para conectar ao GitHub, primeiro escolha a conta e o repositório privado desejados; nunca inclua tokens em comandos ou arquivos do projeto.

## Referências

- [Tailwind com Vite](https://tailwindcss.com/docs/installation/using-vite)
- [Prisma ORM 7](https://www.prisma.io/docs/orm/v7)
