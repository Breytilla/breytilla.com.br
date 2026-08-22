# Variáveis de ambiente: Vercel + Supabase

Este projeto usa a Supabase somente como PostgreSQL. Ele **não usa** o SDK da
Supabase, Auth, Storage ou Data API. Por isso, não copie `anon`, publishable,
`service_role` ou secret keys para o projeto: o backend precisa da **connection
string do banco**, e o navegador não precisa de nenhuma chave da Supabase.

Referências oficiais: [Vercel Environment Variables](https://vercel.com/docs/environment-variables),
[Supabase: Connect to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
e [Supabase na Vercel](https://supabase.com/docs/guides/integrations/vercel-marketplace).

## 1. Obter as conexões na Supabase

No projeto da Supabase, abra **Connect**:

1. Para `DATABASE_URL`, copie a URI do **Transaction Pooler**, porta `6543`.
   Ela é a conexão indicada para funções serverless. O projeto já usa
   `prepare: false`, conforme a limitação do pooler transacional.
2. Para `DATABASE_MIGRATION_URL`, copie a conexão **Direct**. Se a rede onde a
   migração rodará não tiver IPv6, use o **Session Pooler**, porta `5432`.
3. Substitua o marcador da senha pela senha real do banco. Se você montar a URI
   manualmente, caracteres especiais da senha precisam de percent-encoding;
   prefira copiar a URI pronta mostrada pela Supabase.

Não use o Transaction Pooler para `npm run db:migrate`: a migração usa lock de
sessão e DDL. A URL de migração serve apenas para a operação administrativa; o
runtime do site continua usando o pooler transacional.

## 2. Criar as variáveis na Vercel

Abra **Vercel > projeto > Settings > Environment Variables**. Cadastre em
**Production**:

| Variável | Origem/valor |
| --- | --- |
| `APP_URL` | `https://breytilla.com.br` |
| `DATABASE_URL` | Supabase Transaction Pooler (`6543`) |
| `RESEND_TRANSACTIONAL_API_KEY` | API key exclusiva do canal transacional |
| `RESEND_MARKETING_API_KEY` | API key exclusiva do canal de marketing |
| `RESEND_WEBHOOK_SECRET` | Signing secret do webhook no Resend |
| `EMAIL_TRANSACTIONAL_FROM` | `Breytilla <notificacoes@notificacoes.breytilla.com.br>` |
| `EMAIL_MARKETING_FROM` | `Breytilla <conteudos@conteudos.breytilla.com.br>` |
| `EMAIL_REPLY_TO` | Caixa monitorada para respostas |
| `EMAIL_INTERNAL_TO` | Caixa que recebe novos pedidos de contato |
| `RESEND_MARKETING_TOPIC_ID` | ID do Topic criado no Resend |
| `RESEND_MARKETING_SEGMENT_ID` | ID do Segment criado no Resend |
| `CRON_SECRET` | Segredo aleatório com pelo menos 32 caracteres |
| `EMAIL_OUTBOX_ENCRYPTION_KEY` | Outro segredo aleatório, estável, com pelo menos 32 caracteres |
| `ADMIN_ROUTE_KEY` | Palavra discreta usada somente no endereço de entrada do painel |
| `ADMIN_USERNAME` | Usuário/e-mail autorizado a entrar no painel |
| `ADMIN_DISPLAY_NAME` | Nome exibido na interface administrativa |
| `ADMIN_PASSWORD_HASH` | Hash `scrypt...` gerado por `npm run admin:hash-password` |
| `ADMIN_SESSION_SECRET` | Terceiro segredo aleatório, exclusivo para fingerprints de segurança |

No painel da Vercel, marque como **Sensitive** as duas URLs de banco, as chaves
Resend, o signing secret, `CRON_SECRET`, `EMAIL_OUTBOX_ENCRYPTION_KEY`,
`ADMIN_PASSWORD_HASH` e `ADMIN_SESSION_SECRET`. Gere os três segredos aleatórios
separadamente, sem reutilizar
o resultado:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

`DATABASE_MIGRATION_URL` não é necessária para atender requisições do site.
Guarde-a preferencialmente no gerenciador de segredos do ambiente que executará
as migrações. Se a migração for executada com `vercel env run`, ela também pode
ser cadastrada somente em Production, ciente de que ficará disponível às
funções desse ambiente.

Depois de cadastrar ou alterar uma variável, faça um novo deployment; mudanças
de ambiente não alteram deployments já existentes.

Cadastre `CRON_SECRET` somente em Production, sem quebras de linha. O Vercel
Cron usa essa variável para enviar automaticamente o header Bearer às rotas
internas. Antes de adicionar os agendamentos ao `vercel.json`, confirme o plano:
a outbox exige frequência por minuto, disponível em Pro/Enterprise; Hobby aceita
somente frequência diária. A configuração e a alternativa com agendador externo
estão detalhadas em [email-operations.md](email-operations.md#webhook-e-cron).

## 3. Alternativa: integração Supabase–Vercel

Se conectar a Supabase pelo Marketplace da Vercel, a integração pode criar
automaticamente `POSTGRES_URL` e `POSTGRES_URL_NON_POOLING`. O código aceita:

- `POSTGRES_URL` como alias de `DATABASE_URL` no runtime;
- `POSTGRES_URL_NON_POOLING` como alias de `DATABASE_MIGRATION_URL` nas migrações.

Não duplique as URLs com nomes diferentes sem necessidade. A integração também
pode criar chaves `NEXT_PUBLIC_SUPABASE_*` e `SUPABASE_*`; elas permanecem sem
uso neste projeto. Nunca renomeie uma secret/service-role key para um nome
`NEXT_PUBLIC_*`.

## 4. Preview e desenvolvimento

Não compartilhe o banco e as chaves Resend de produção com deployments de
Preview. Para testar formulários em Preview, crie um projeto Supabase de teste,
chaves Resend de teste e um `APP_URL` correspondente a uma URL de preview
estável. Sem isso, mantenha as variáveis somente em Production.

Localmente, copie `.env.example` para `.env.local` e preencha valores reais.
`.env.local`, os demais `.env*`, `.vercel/` e o estado temporário do Supabase
CLI estão ignorados pelo Git. Somente `.env.example`, sem segredos, é versionado.

## 5. Conferir e migrar

O verificador apenas confere presença/formato e não imprime valores nem acessa
Supabase ou Resend:

```bash
npm run env:check
```

Com a Vercel CLI vinculada ao projeto:

```bash
npx vercel env ls production
npx vercel env run -e production -- npm run env:check
npx vercel env pull .env.local --environment=development
```

`vercel env pull` grava os segredos em disco; mantenha o arquivo local e nunca o
adicione ao Git. Para executar a primeira migração, confirme visualmente que a
URL aponta para o projeto Supabase correto e então rode:

```bash
npm run db:migrate
```

As migrations habilitam RLS sem policies e revogam acesso de `PUBLIC`, `anon`,
`authenticated` e `service_role` nas tabelas de e-mail. O acesso continua
exclusivo à conexão PostgreSQL server-side usada pela aplicação; não tente
consultar essas tabelas pelas APIs da Supabase.

Se `DATABASE_MIGRATION_URL` estiver guardada na Vercel, execute sem gravar os
segredos localmente:

```bash
npx vercel env run -e production -- npm run db:migrate
```

O build não executa migrações automaticamente.
