import { Link, Section } from "react-email";

import { EmailButton } from "../components/email-button";
import {
  EmailEyebrow,
  EmailHeading,
  EmailParagraph,
} from "../components/typography";
import { TransactionalLayout } from "../layouts/transactional-layout";
import { emailStyles, emailTheme } from "../theme";
import type { NewsletterConfirmOptInEmailProps } from "../types";

export function NewsletterConfirmOptInEmail({
  name,
  confirmationUrl,
}: NewsletterConfirmOptInEmailProps) {
  return (
    <TransactionalLayout preview="Confirme sua inscrição para receber conteúdos e novidades.">
      <EmailEyebrow>Confirmação de inscrição</EmailEyebrow>
      <EmailHeading>
        {name ? `Olá, ${name}.` : "Só falta confirmar seu e-mail."}
      </EmailHeading>
      <EmailParagraph>
        Recebemos um pedido para incluir este endereço na lista de conteúdos e
        novidades da Breytilla.
      </EmailParagraph>
      <EmailParagraph>
        Para concluir a inscrição, confirme seu e-mail pelo botão abaixo.
      </EmailParagraph>

      <Section style={actionSection}>
        <EmailButton href={confirmationUrl}>Confirmar inscrição</EmailButton>
      </Section>

      <Section style={emailStyles.note}>
        Se você não fez esse pedido, ignore esta mensagem. Seu endereço não
        será inscrito sem a confirmação.
      </Section>

      <EmailParagraph muted style={fallbackText}>
        Se o botão não funcionar, copie e cole este endereço no navegador:{" "}
        <Link href={confirmationUrl} style={fallbackLink}>
          {confirmationUrl}
        </Link>
      </EmailParagraph>
    </TransactionalLayout>
  );
}

NewsletterConfirmOptInEmail.PreviewProps = {
  name: "Marina",
  confirmationUrl:
    "https://breytilla.com.br/newsletter/confirmar?token=exemplo-seguro",
} satisfies NewsletterConfirmOptInEmailProps;

export default NewsletterConfirmOptInEmail;

const actionSection = {
  margin: "28px 0 30px",
};

const fallbackText = {
  marginTop: "24px",
};

const fallbackLink = {
  color: emailTheme.colors.cocoa,
  overflowWrap: "anywhere" as const,
  textDecoration: "underline",
};
