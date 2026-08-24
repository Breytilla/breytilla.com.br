import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Aviso de Privacidade | Breytilla",
  description:
    "Como os dados de contato, newsletter e métricas de visita do site da Breytilla são utilizados e protegidos.",
  alternates: {
    canonical: "/privacidade",
  },
};

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <header className="container privacy-header">
        <Link className="wordmark" href="/" aria-label="Breytilla — início">
          Brey<em>tilla</em>
        </Link>
        <Link className="privacy-back" href="/">
          Voltar ao site
        </Link>
      </header>

      <article className="container privacy-content">
        <p className="eyebrow">Transparência e cuidado</p>
        <h1>Aviso de Privacidade</h1>
        <p className="privacy-version">Versão de 24 de agosto de 2026.</p>
        <p className="privacy-lead">
          Este aviso explica, de forma objetiva, como são utilizados os dados
          enviados pelos formulários e, quando você autoriza, as métricas de
          visita do site. Os formulários não são um canal de atendimento
          clínico e não solicitam relatos sobre saúde ou sobre o motivo da busca
          por psicoterapia.
        </p>

        <section className="privacy-section">
          <h2>Quem trata os dados</h2>
          <p>
            A responsável pelo tratamento é Breytilla Katyeliny Silva Souza,
            Psicóloga, CRP 06/180155. Dúvidas e solicitações sobre privacidade
            podem ser enviadas para{" "}
            <a href="mailto:psibreytillak@gmail.com">
              psibreytillak@gmail.com
            </a>
            .
          </p>
        </section>

        <section className="privacy-section">
          <h2>Dados e finalidades</h2>
          <ul>
            <li>
              No contato: nome, e-mail, telefone opcional, canal preferido e
              data do pedido, usados para responder à solicitação.
            </li>
            <li>
              Na newsletter: e-mail, primeiro nome opcional, versão e datas do
              consentimento, usados para confirmar e administrar a assinatura.
            </li>
            <li>
              Na entrega: identificadores e estados técnicos, como enviado,
              entregue, devolvido ou marcado como spam, usados para segurança e
              qualidade do envio.
            </li>
            <li>
              Nas métricas opcionais: páginas acessadas, origem da visita,
              informações técnicas do navegador e do dispositivo e interações
              de navegação, usadas para compreender o uso e melhorar o site.
            </li>
          </ul>
          <p>
            A solicitação de contato não gera inscrição em marketing. A
            newsletter exige uma escolha separada e uma confirmação posterior
            por e-mail. O conteúdo dos formulários, nomes, e-mails, telefones e
            relatos sobre saúde não são enviados ao Google Analytics.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Compartilhamento e proteção</h2>
          <p>
            Os dados são compartilhados somente com os provedores necessários
            para hospedar o site, manter o banco de dados e enviar e-mails. O
            Resend atua no envio e na gestão das preferências da newsletter.
            Quando autorizado, o Google Analytics 4 atua como provedor das
            métricas de visita. Seus recursos de publicidade e personalização
            ficam desativados. Chaves de acesso permanecem no servidor, e o
            sistema não registra o conteúdo dos e-mails nem endereços em logs
            de aplicação.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Google Analytics e sua preferência</h2>
          <p>
            O Google Analytics só é carregado depois que você seleciona
            “Aceitar métricas”. A escolha fica guardada no armazenamento local
            do navegador para que o site possa respeitá-la nas próximas visitas.
            Se você recusar, nenhum código do Analytics é carregado.
          </p>
          <p>
            Você pode aceitar, recusar ou mudar a decisão a qualquer momento no
            botão “Preferências de privacidade”, exibido nas páginas medidas. Ao
            revogar uma autorização, o site interrompe o Analytics e remove os
            cookies de métricas que consegue acessar. A área administrativa e
            as páginas de confirmação da newsletter não são medidas.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Conservação e escolhas</h2>
          <p>
            Pedidos de contato sem continuidade são mantidos pelo tempo
            necessário para resposta e controle operacional. Dados da newsletter
            ficam ativos enquanto durar a assinatura. Após o descadastro, podem
            permanecer registros mínimos para respeitar a escolha e demonstrar o
            histórico de consentimento, observadas as necessidades legais e de
            exercício de direitos. As métricas permanecem pelo período definido
            na configuração da propriedade do Google Analytics.
          </p>
          <p>
            Cada newsletter oferece descadastro. Revogar o consentimento para
            marketing não impede respostas necessárias a um contato solicitado
            pela própria pessoa.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Seus direitos</h2>
          <p>
            Você pode solicitar confirmação do tratamento, acesso, correção,
            informações sobre compartilhamento, eliminação quando aplicável e
            revogação do consentimento. Envie o pedido ao e-mail informado
            acima. A{" "}
            <a
              href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares"
              target="_blank"
              rel="noopener noreferrer"
            >
              ANPD apresenta uma explicação dos direitos dos titulares
            </a>
            .
          </p>
        </section>

        <section className="privacy-section">
          <h2>Atualizações</h2>
          <p>
            Mudanças relevantes de finalidade ou de tratamento serão
            apresentadas neste aviso. Quando uma alteração exigir novo
            consentimento para a newsletter, uma nova confirmação será
            solicitada.
          </p>
        </section>
      </article>
    </main>
  );
}
