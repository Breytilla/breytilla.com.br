# Operação de e-mails

Este projeto está em estado **greenfield**: código, migração e templates podem estar presentes, mas isso não significa que banco, DNS, domínios, API keys, Topic, Segment, webhook ou cron já estejam provisionados. Nenhum envio de produção deve ocorrer antes de concluir o checklist deste documento.

## Responsabilidades dos canais

- **Transacional:** confirma uma ação individual (contato recebido e double opt-in) usando a chave e o remetente transacionais. Não inclui promoção e não depende da preferência de marketing.
- **Marketing:** usa exclusivamente Contacts, Segment, Topic e Broadcasts do Resend. O sistema nunca percorre destinatários com `emails.send` para distribuir newsletter.
- **React Email:** fornece os layouts e templates versionados para ambos os canais, mas não mistura as interfaces de envio.

O e-mail de confirmação do double opt-in é transacional, embora sua consequência seja habilitar marketing. Ele deve conter somente a solicitação de confirmação.

## Preparação do ambiente

O passo a passo específico para criar as variáveis na Vercel e selecionar as
conexões corretas da Supabase está em
[vercel-supabase-environment.md](vercel-supabase-environment.md).

1. Copie as variáveis documentadas em `.env.example` para o gerenciador de segredos do ambiente. Em desenvolvimento local, use `.env.local` e nunca faça commit dos valores reais.
2. Preencha `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `APP_URL`, as duas API keys do Resend, remetentes, `EMAIL_REPLY_TO`, IDs de Topic/Segment, `RESEND_WEBHOOK_SECRET`, `CRON_SECRET` e `EMAIL_OUTBOX_ENCRYPTION_KEY`.
3. Gere segredos distintos, longos e aleatórios. `EMAIL_OUTBOX_ENCRYPTION_KEY` deve ser estável e ter no mínimo 32 caracteres; não a rotacione enquanto existir item pendente ou em retentativa na outbox, pois o worker precisa dela para descriptografar o payload. Conceda à chave transacional apenas envio de e-mail e à chave de marketing somente as permissões necessárias para Contacts/Segments/Topics/Broadcasts, conforme as opções disponíveis no painel.
4. Faça backup e valide o destino de `DATABASE_MIGRATION_URL`; somente então execute `npm run db:migrate`. Na Supabase, use a conexão Direct ou Session Pooler para migrações e reserve o Transaction Pooler para `DATABASE_URL`. A migração não é executada automaticamente pelo build ou pelo CLI de campanhas.
5. Rode `npm run lint`, `npm run test` e `npm run build` antes de liberar o ambiente.

O comando `preview` não carrega nem exige segredos. Os demais comandos carregam `.env*` pelo `@next/env`, exigem banco migrado e falham antes de operar se faltar configuração.

## Provisionamento manual no Resend e DNS

### Domínios e credenciais

1. No Resend, adicione `notificacoes.breytilla.com.br` para e-mails transacionais e `conteudos.breytilla.com.br` para marketing.
2. Em cada zona DNS, crie **exatamente** os registros de SPF/DKIM exibidos pelo Resend para aquele subdomínio e aguarde o status `verified`.
3. Não edite, consolide ou remova o SPF do domínio raiz durante esta fase. Ele pode continuar autorizando o SendPulse e outros serviços. Os novos registros devem ficar nos hostnames dos subdomínios indicados pelo Resend.
4. Valide que `EMAIL_TRANSACTIONAL_FROM` usa o subdomínio transacional e `EMAIL_MARKETING_FROM` usa o subdomínio de conteúdo. Configure um `Reply-To` monitorado.
5. Crie duas API keys distintas e guarde-as somente no backend/gerenciador de segredos.
6. Faça testes de autenticação e entrega nos dois canais antes de alterar qualquer registro legado. Registre os valores DNS anteriores para rollback.

### Topic e Segment

1. Crie um Topic público chamado, por exemplo, `Conteúdos e novidades`.
2. Selecione o padrão **Opt-out** do Resend. Na terminologia atual do produto, isso faz com que o contato só receba o Topic após inscrição explícita; o padrão não pode ser alterado depois da criação.
3. Crie um Segment interno para assinantes confirmados e salve seus IDs em `RESEND_MARKETING_TOPIC_ID` e `RESEND_MARKETING_SEGMENT_ID`.
4. Ao confirmar o double opt-in, marque o contato como inscrito no Topic e adicione-o ao Segment. Um contato pendente, descadastrado, suprimido, com bounce permanente ou complaint não é elegível.

Segments definem **quem** pode receber; Topics registram **qual categoria** de conteúdo a pessoa aceitou. Todo Broadcast deve informar os dois e conter o placeholder literal `{{{RESEND_UNSUBSCRIBE_URL}}}`. O Resend substitui esse alvo por uma URL individual e aplica a preferência do contato. Consulte a documentação de [Topics](https://resend.com/docs/dashboard/topics/introduction) e [Segments](https://resend.com/docs/dashboard/segments/introduction).

## Webhook e cron

No painel do Resend, aponte o webhook de produção para `POST /api/webhooks/resend` no domínio HTTPS do projeto e assine pelo menos estes eventos:

- `email.sent`
- `email.delivered`
- `email.delivery_delayed`
- `email.failed`
- `email.bounced`
- `email.complained`
- `email.suppressed`
- `contact.updated`

Copie o signing secret para `RESEND_WEBHOOK_SECRET`. A aplicação deve verificar a assinatura sobre o corpo bruto, deduplicar pelo ID do evento e não registrar corpo, conteúdo do e-mail ou endereço completo em logs. Entregas repetidas do mesmo webhook são esperadas e não podem duplicar efeitos.

As duas rotas internas aceitam `GET` e `POST`, mas sempre exigem:

```http
Authorization: Bearer <CRON_SECRET>
```

O [Vercel Cron](https://vercel.com/docs/cron-jobs) chama a URL de produção com
`GET`. Quando `CRON_SECRET` existe nas variáveis de Production, a plataforma
envia automaticamente o valor como `Authorization: Bearer <CRON_SECRET>`. Um
agendador externo pode usar `GET` ou manter o `POST` já suportado. Use HTTPS e
nunca coloque o segredo na query string.

Confirme o plano da conta antes de adicionar `vercel.json`. Em Pro ou Enterprise,
configure a outbox a cada minuto e a reconciliação uma vez por dia, por exemplo:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/internal/email-outbox",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/internal/email-reconcile",
      "schedule": "20 6 * * *"
    }
  ]
}
```

As expressões da Vercel usam UTC. O plano Hobby permite cada cron somente uma
vez ao dia; uma expressão por minuto faz o deployment falhar. Nesse plano, use
um agendador externo confiável para chamar a outbox a cada minuto com o mesmo
Bearer secret, ou faça upgrade antes de versionar a configuração acima. Não
reduza silenciosamente a outbox para uma execução diária, pois isso atrasaria
envios e retentativas transacionais. Consulte os [limites atuais por
plano](https://vercel.com/docs/cron-jobs/usage-and-pricing).

O job de reconciliação primeiro recupera sincronizações pós-confirmação pendentes
e depois processa um lote limitado de contatos, consultando o estado global e o
Topic no Resend. O consentimento é sempre commitado no PostgreSQL antes de
qualquer inclusão no Segment. Opt-out no provedor atualiza o banco e remove o
contato; estado ausente ou divergente bloqueia marketing e tenta removê-lo até
uma execução posterior bem-sucedida.

Um `401` indica que `CRON_SECRET` está ausente ou divergente. Monitore também
respostas `5xx` no painel: a Vercel não repete automaticamente uma invocação que
falhou. A outbox usa lotes, lock no PostgreSQL e idempotency key no Resend para
tolerar invocações sobrepostas, mas evite disparar a reconciliação manualmente em
paralelo. Veja [erros, concorrência e
logs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Double opt-in e privacidade

Os endpoints públicos são `POST /api/contact`, `POST /api/newsletter`, `GET /api/newsletter/confirm?token=...` e `POST /api/newsletter/confirm`. O `GET` apenas abre a tela de confirmação; somente o `POST` acionado pelo botão consome o token. Isso evita que scanners automáticos de links confirmem uma assinatura.

1. O cadastro de newsletter cria ou atualiza o contato como `pending`, registra a versão do consentimento e envia um token de uso único com validade de 24 horas pelo canal transacional.
2. A resposta do formulário deve ser neutra para não revelar se o endereço já existe.
3. Somente a confirmação válida registra `opt_in_confirmed` e cria uma sincronização recuperável. O contato permanece inelegível até o worker ativar Contact/Topic/Segment e gravar o estado `subscribed`.
4. Descadastro, complaint, suppression ou hard bounce sempre vence um opt-in anterior. Divergências entre banco e Resend bloqueiam marketing até reconciliação.
5. Uma nova inscrição depois de descadastro deve repetir o double opt-in; nunca reative a pessoa apenas por importação ou ação administrativa.

Colete apenas nome e meios de contato necessários. Não armazene motivo da terapia, diagnóstico, conteúdo clínico, texto livre sensível ou segmentação de saúde em Contacts, propriedades, tags, manifestos, payloads, métricas ou logs. Restrinja acesso, retenha prova de consentimento e trate pedidos de titulares conforme a política de privacidade/LGPD aplicável.

As rotas exigem `Origin` do próprio site, honeypot e limites globais/por endereço no banco. Antes de expô-las em produção, configure também rate limiting na borda e um CAPTCHA compatível com a política de privacidade; controles apenas na aplicação não substituem proteção contra tráfego distribuído.

## CLI seguro de campanhas

O arquivo `campaigns/example-newsletter.json` é somente um exemplo. Seu nome, assunto e versão estão marcados como demonstração; ele não é criado, agendado ou enviado automaticamente. Copie-o para outro arquivo, escolha um `campaignKey` imutável e revise o conteúdo.

Gerar HTML e texto localmente, sem banco ou segredos:

```bash
npm run email:campaign -- preview campaigns/example-newsletter.json
```

Os arquivos são gravados em `out/email-campaigns/`. Revise links, assunto, preheader, texto simples, acessibilidade e a presença literal do descadastro.

Criar um Broadcast como draft (ou atualizar o mesmo draft ainda não agendado):

```bash
npm run email:campaign -- draft campaigns/minha-campanha.json
```

Esse comando nunca envia automaticamente. Ele pode atualizar o mesmo `campaignKey` enquanto o registro continuar em `draft`; depois de agendar, enviar, cancelar ou falhar, crie uma nova chave em vez de reutilizá-la. Revise também o draft no painel do Resend e, para teste real, use primeiro um Segment piloto composto apenas por endereços internos consentidos.

Agendar exige repetir o `campaignKey` como confirmação explícita e usar ISO 8601 futuro com fuso. O horário deve ficar no máximo 30 minutos à frente, para que o preflight de consentimento permaneça próximo do envio:

```bash
npm run email:campaign -- schedule minha-campanha 2026-09-01T13:00:00-03:00 --confirm minha-campanha
```

Enviar imediatamente também exige confirmação explícita:

```bash
npm run email:campaign -- send minha-campanha --confirm minha-campanha
```

Cancelar uma campanha ainda agendada:

```bash
npm run email:campaign -- cancel minha-campanha
```

Antes de agendar ou enviar, o CLI pagina o Segment no Resend e compara seus IDs com os contatos locais `subscribed`, confirmados, sincronizados e reconciliados nas últimas 36 horas. Qualquer diferença ou erro de API bloqueia a operação sem expor endereços. Depois do preflight, uma transição atômica de `draft` para `sending` impede dois operadores de iniciarem a mesma campanha.

O CLI consulta o `resend_broadcast_id` no PostgreSQL, chama somente `resend.broadcasts.*` e atualiza a tabela `campaigns`. Ele recusa agendar/enviar algo que não esteja em `draft`, recusa cancelar algo que não esteja `scheduled` e nunca recebe uma lista de destinatários. Se uma falha ou interrupção deixar o estado `sending`, não repita a operação: confira o Broadcast no Resend e reconcilie o banco primeiro, pois o resultado remoto pode ser incerto. A API de Broadcasts está descrita em [Create Broadcast](https://resend.com/docs/api-reference/broadcasts/create-broadcast) e [Send Broadcast](https://resend.com/docs/api-reference/broadcasts/send-broadcast).

## Testes e liberação gradual

Antes de cada campanha:

- valide o manifesto e gere o preview HTML/texto;
- abra o HTML em tela pequena e grande e teste todos os links;
- confirme que o placeholder de descadastro aparece nas duas versões;
- confira Topic, Segment, remetente e `Reply-To` no draft;
- envie para o Segment piloto e confira Gmail, Outlook e ao menos um cliente móvel;
- verifique webhooks, atualização de status, suppression e descadastro com uma conta de teste;
- confirme que nenhum endereço pendente, descadastrado ou sem prova de consentimento entrou no Segment.

Defina também uma rotina de retenção aprovada pelo negócio para anonimizar ou remover pedidos de contato já encerrados, tokens expirados, payloads de outbox entregues e eventos técnicos além do prazo necessário. Não automatize exclusões antes de validar obrigações legais e a necessidade de manter a prova mínima de consentimento/descadastro.

No primeiro rollout, libere apenas novos cadastros confirmados e aumente o lote gradualmente. Pause os próximos envios se complaints ultrapassarem 0,1%, hard bounces ultrapassarem 2%, webhooks pararem de processar ou houver divergência de consentimento.

## Rollback e migração do SendPulse

Para interromper marketing sem afetar e-mails transacionais:

1. Cancele Broadcasts agendados.
2. Suspenda a chave `RESEND_MARKETING_API_KEY` ou remova o Segment do fluxo de publicação.
3. Preserve banco, consent events e webhooks para investigação; não reenvie automaticamente uma campanha de estado incerto.
4. Mantenha o canal transacional e sua chave separados.

Migre o SendPulse somente após o fluxo novo estar estável:

1. Exporte endereços junto com fonte, data e versão da prova de consentimento.
2. Normalize e deduplique; exclua descadastrados, complaints, suppressions e hard bounces.
3. Não importe registros sem prova suficiente. Convide-os a um novo double opt-in por um canal permitido, sem marcá-los previamente como inscritos.
4. Importe em lotes pequenos para Contacts, ative explicitamente o Topic e inclua no Segment apenas os elegíveis.
5. Compare contagens, amostras, bounces, complaints e descadastros antes de ampliar o lote.
6. Mantenha o SendPulse disponível para rollback até comprovar que não há automações, formulários ou campanhas dependentes.
7. Só então retire a autorização do SendPulse do SPF raiz, usando inventário DNS, revisão por outra pessoa e plano de restauração. Nunca remova o registro raiz inteiro para substituir por um registro do Resend.
