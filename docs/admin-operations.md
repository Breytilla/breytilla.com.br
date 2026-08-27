# Área administrativa

A entrada do painel usa uma palavra discreta no endereço, mas essa palavra não
é uma senha. A proteção real combina credencial com hash `scrypt`, bloqueio de
tentativas, sessão opaca revogável no PostgreSQL e cookie `HttpOnly`.

## Configuração inicial

1. Escolha `ADMIN_ROUTE_KEY` com 6 a 64 caracteres minúsculos, números e hífens.
   Ela não aparece no menu, sitemap ou `robots.txt`. O acesso será
   `https://breytilla.com.br/<ADMIN_ROUTE_KEY>`. Não use `blog`, `privacidade`,
   `newsletter` ou `api`, que são rotas reservadas.
2. Defina `ADMIN_USERNAME` e `ADMIN_DISPLAY_NAME`.
3. Gere o hash da senha sem salvá-la no código:

   ```bash
   npm run admin:hash-password
   ```

   Use uma senha com pelo menos 8 caracteres. Uma frase-senha mais longa continua
   sendo recomendada. Copie somente o resultado `scrypt...` para
   `ADMIN_PASSWORD_HASH`.
4. Gere `ADMIN_SESSION_SECRET` com pelo menos 32 bytes aleatórios e não reutilize
   `CRON_SECRET` nem `EMAIL_OUTBOX_ENCRYPTION_KEY`.
5. Cadastre as variáveis apenas no servidor/Vercel, sem prefixo `NEXT_PUBLIC_`.
6. Aplique a migration antes de abrir o painel:

   ```bash
   npm run db:migrate
   npm run env:check
   ```

## Operação

- **Blog:** crie rascunhos, revise e publique. O texto é renderizado como texto
  seguro; não são aceitos HTML ou scripts executáveis.
- **E-mail marketing:** salvar cria ou atualiza um Broadcast em rascunho no
  Resend. O envio exige digitar `ENVIAR`, uma sessão recente e um preflight que
  compara o Segment do Resend com os consentimentos locais reconciliados.
- **Contatos:** exibe somente os dados necessários para acompanhamento.
- **Logout:** revoga a sessão no banco, além de apagar o cookie.

Se o resultado do Resend for incerto, a campanha permanece em `sending`. Não a
envie novamente: reconcilie o estado no provedor para evitar duplicidade.

Se o acesso sofrer bloqueios repetidos por tentativas distribuídas, troque
`ADMIN_ROUTE_KEY`, faça um novo deploy e aplique proteção de borda à nova rota.
Um bloqueio isolado expira em 15 minutos; não remova o limite global para
contornar o incidente.
