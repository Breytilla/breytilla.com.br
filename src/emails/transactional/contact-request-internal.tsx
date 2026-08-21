import { Hr, Section, Text } from "react-email";

import {
  EmailEyebrow,
  EmailHeading,
  EmailParagraph,
  EmailSubheading,
} from "../components/typography";
import { TransactionalLayout } from "../layouts/transactional-layout";
import { emailStyles, emailTheme } from "../theme";
import type {
  ContactRequestInternalEmailProps,
  PreferredContactChannel,
} from "../types";

const channelLabels: Record<PreferredContactChannel, string> = {
  email: "E-mail",
  phone: "Telefone",
  whatsapp: "WhatsApp",
};

export function ContactRequestInternalEmail({
  name,
  email,
  phone,
  preferredChannel,
  requestId,
  submittedAt,
}: ContactRequestInternalEmailProps) {
  return (
    <TransactionalLayout preview={`Novo contato recebido de ${name}.`}>
      <EmailEyebrow>Novo contato</EmailEyebrow>
      <EmailHeading>Uma nova solicitação chegou pelo site.</EmailHeading>
      <EmailParagraph>
        Estes são os dados necessários para realizar o retorno. Nenhuma
        informação clínica foi incluída neste e-mail.
      </EmailParagraph>

      <Hr style={emailStyles.divider} />
      <EmailSubheading style={detailsHeading}>Dados para retorno</EmailSubheading>

      <Section aria-label="Dados da solicitação">
        <Detail label="Nome" value={name} />
        <Detail label="E-mail" value={email} />
        <Detail label="Telefone" value={phone ?? "Não informado"} />
        <Detail
          label="Canal preferido"
          value={channelLabels[preferredChannel]}
        />
        <Detail label="Identificador" value={requestId} />
        <Detail label="Recebido em" value={submittedAt} />
      </Section>
    </TransactionalLayout>
  );
}

interface DetailProps {
  label: string;
  value: string;
}

function Detail({ label, value }: DetailProps) {
  return (
    <Section style={detail}>
      <Text style={detailLabel}>{label}</Text>
      <Text style={detailValue}>{value}</Text>
    </Section>
  );
}

ContactRequestInternalEmail.PreviewProps = {
  name: "Marina Alves",
  email: "marina@example.com",
  phone: "+55 16 99999-0000",
  preferredChannel: "whatsapp",
  requestId: "contato_01JXYZ123",
  submittedAt: "20/08/2026 às 10:30",
} satisfies ContactRequestInternalEmailProps;

export default ContactRequestInternalEmail;

const detailsHeading = {
  marginTop: 0,
};

const detail = {
  borderBottom: `1px solid ${emailTheme.colors.line}`,
  padding: "12px 0 11px",
};

const detailLabel = {
  color: emailTheme.colors.muted,
  fontFamily: emailTheme.fonts.body,
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "1.2px",
  lineHeight: "16px",
  margin: 0,
  textTransform: "uppercase" as const,
};

const detailValue = {
  color: emailTheme.colors.cocoa,
  fontFamily: emailTheme.fonts.body,
  fontSize: "15px",
  lineHeight: "23px",
  margin: "4px 0 0",
  overflowWrap: "anywhere" as const,
};
