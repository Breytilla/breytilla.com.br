# breytilla.com.br

Site em Next.js da Breytilla, com formulário de primeiro contato e newsletter por double opt-in.

Também inclui blog público e uma área administrativa privada para posts, contatos e campanhas de e-mail.

Os e-mails usam uma biblioteca visual compartilhada em React Email, mas possuem canais operacionais separados no Resend:

- transacionais via Send Email e outbox PostgreSQL;
- marketing via Contacts, Topic, Segment e Broadcasts.

## Desenvolvimento

```bash
npm install
copy .env.example .env.local
npm run env:check
npm run db:migrate
npm run dev
```

Comandos de qualidade e e-mail:

```bash
npm run lint
npm test
npm run build
npm run email:dev
npm run email:campaign -- preview campaigns/example-newsletter.json
npm run admin:hash-password
```

O acesso administrativo está documentado em [docs/admin-operations.md](docs/admin-operations.md). O provisionamento de banco, DNS, chaves, webhook, cron, campanhas e a migração do SendPulse está documentado em [docs/email-operations.md](docs/email-operations.md). Para criar as variáveis na Vercel usando as conexões da Supabase, siga [docs/vercel-supabase-environment.md](docs/vercel-supabase-environment.md). Nenhum envio, migração ou alteração de DNS ocorre durante o build.
