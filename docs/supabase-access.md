# Acesso do backend ao Supabase

Projeto autorizado: `exercicios-acad` (`exvcchwfftfafaovkydj`).

O backend manterá Prisma e usará conexões diferentes para execução e migrations:

| Papel         | Acesso                                                                               | Uso                                                                               |
| ------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `ht_api`      | Sem login e sem bypass de RLS; limitado às tabelas da aplicação                      | Papel assumido dentro das transações autenticadas                                 |
| `ht_runtime`  | Login, sem herança automática e sem bypass de RLS; pode assumir `ht_api`             | `DATABASE_URL`, usada pelo Fastify                                                |
| `ht_migrator` | Login e bypass de RLS; permissões administrativas restritas aos objetos da aplicação | `DIRECT_URL`, usada exclusivamente nos scripts de migration, seed e transferência |

As senhas dos dois logins serão geradas aleatoriamente, sem alterar a senha `postgres` do projeto. Serão salvas somente nos ambientes locais ignorados pelo Git; não serão enviadas no chat ou incluídas no frontend.

A conexão normal da API será obrigada a executar como `ht_api` e receberá somente a identidade previamente validada no Supabase Auth. As políticas verificarão o dono inclusive nas tabelas filhas. O frontend usará exclusivamente a chave publicável.

Uma função temporária de provisionamento, sem permissão de execução para os clientes públicos, será removida assim que as credenciais estiverem configuradas. O banco local e seu backup serão preservados.

A criação desses papéis remotos depende da aprovação específica de mudança das permissões de banco.
