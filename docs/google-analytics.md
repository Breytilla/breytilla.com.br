# Google Analytics 4

O site usa o fluxo Web `G-55F5PCD39G` por meio do componente otimizado do
Next.js. O Analytics é carregado somente depois do aceite de métricas e apenas
na página inicial, no blog e no aviso de privacidade.

A área administrativa e as páginas de confirmação da newsletter ficam fora da
coleta para não enviar caminhos privados ou tokens ao Google.

## Ambiente

A variável abaixo é pública e incorporada durante o build:

```dotenv
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-55F5PCD39G
```

Cadastre-a nos ambientes de Production e Preview da Vercel e faça um novo
deploy sempre que o valor mudar. O arquivo `.env.local` já contém o valor para
desenvolvimento local.

## Painel do GA4

No fluxo Web, abra **Medição otimizada > Configurações avançadas de visualização
de página** e mantenha habilitada a opção de registrar mudanças de página com
base nos eventos do histórico do navegador. O Next.js usa navegação no cliente,
e essa opção registra as trocas de rota sem código manual.

Não crie outro disparo manual de `page_view`: a combinação dos dois métodos
duplicaria as visualizações.

Como esta é uma atividade de saúde, revise também no painel:

- o período de retenção de dados;
- a exclusão do tráfego interno usado em testes;
- a ausência de Google Signals e personalização de anúncios;
- os eventos marcados como principais, mantendo apenas interações sem dados
  pessoais ou informações sobre saúde.

## Verificação após o deploy

1. Abra o site em uma janela anônima e confirme que não há requests para
   `googletagmanager.com` antes de escolher.
2. Selecione **Aceitar métricas** e confira o carregamento de `gtag/js` e um
   request `g/collect` sem violações de Content Security Policy.
3. Abra **Relatórios > Tempo real** no GA4 e navegue entre a página inicial e o
   blog. Cada URL deve produzir apenas uma visualização.
4. Acesse diretamente a área administrativa e
   `/newsletter/confirmar?token=teste`; nenhuma requisição do Google Analytics
   deve ocorrer.
5. Use **Preferências de privacidade** para recusar novamente e confirme que o
   Analytics deixa de carregar após a atualização da página.

Bloqueadores de anúncios podem impedir a coleta durante o teste. Repita a
verificação em um perfil de navegador limpo se a visita não aparecer no Tempo
real.

Referências: [integrações de terceiros do Next.js](https://nextjs.org/docs/app/guides/third-party-libraries#google-analytics)
e [medição de aplicações de página única no GA4](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications).
