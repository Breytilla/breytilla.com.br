import { Section } from "react-email";

import {
  EmailEyebrow,
  EmailHeading,
  EmailParagraph,
} from "../components/typography";
import { TransactionalLayout } from "../layouts/transactional-layout";
import { emailStyles } from "../theme";
import type { ContactRequestReceivedEmailProps } from "../types";

export function ContactRequestReceivedEmail({
  name,
}: ContactRequestReceivedEmailProps) {
  return (
    <TransactionalLayout preview="Recebemos sua solicitação e entraremos em contato.">
      <EmailEyebrow>Contato recebido</EmailEyebrow>
      <EmailHeading>Olá, {name}.</EmailHeading>
      <EmailParagraph>
        Sua solicitação chegou até mim. Obrigada por entrar em contato.
      </EmailParagraph>
      <EmailParagraph>
        Assim que possível, retornarei pelo canal informado para conversarmos
        sobre os próximos passos.
      </EmailParagraph>
      <Section style={emailStyles.note}>
        Este e-mail confirma apenas o recebimento da sua solicitação. Não é
        necessário responder a esta mensagem.
      </Section>
    </TransactionalLayout>
  );
}

ContactRequestReceivedEmail.PreviewProps = {
  name: "Marina",
} satisfies ContactRequestReceivedEmailProps;

export default ContactRequestReceivedEmail;
