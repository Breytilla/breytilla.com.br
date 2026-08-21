import { Hr, Link, Section, Text } from "react-email";

import { emailTheme } from "../theme";
import type { UnsubscribeUrl } from "../types";

interface EmailFooterProps {
  stream: "transactional" | "marketing";
  unsubscribeUrl?: UnsubscribeUrl;
}

export function EmailFooter({ stream, unsubscribeUrl }: EmailFooterProps) {
  return (
    <Section style={footer}>
      <Text style={professional}>
        Breytilla Katyeliny Silva Souza · Psicóloga · CRP 06/180155
      </Text>
      <Text style={tagline}>Psicologia com presença, ética e cuidado.</Text>

      <Hr style={divider} />

      {stream === "marketing" && unsubscribeUrl ? (
        <Text style={finePrint}>
          Você recebeu este conteúdo porque confirmou sua inscrição. Se não
          quiser mais receber novidades, pode{" "}
          <Link href={unsubscribeUrl} style={link}>
            cancelar sua inscrição
          </Link>
          .
        </Text>
      ) : (
        <Text style={finePrint}>
          Esta é uma mensagem automática relacionada a uma ação realizada no
          site da Breytilla.
        </Text>
      )}
    </Section>
  );
}

const footer = {
  backgroundColor: emailTheme.colors.cream,
  border: `1px solid ${emailTheme.colors.line}`,
  padding: "27px 44px 30px",
};

const professional = {
  color: emailTheme.colors.cocoa,
  fontFamily: emailTheme.fonts.body,
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: "19px",
  margin: 0,
};

const tagline = {
  color: emailTheme.colors.muted,
  fontFamily: emailTheme.fonts.body,
  fontSize: "12px",
  lineHeight: "19px",
  margin: "3px 0 0",
};

const divider = {
  borderColor: emailTheme.colors.line,
  borderTopWidth: "1px",
  margin: "20px 0",
};

const finePrint = {
  color: emailTheme.colors.muted,
  fontFamily: emailTheme.fonts.body,
  fontSize: "11px",
  lineHeight: "18px",
  margin: 0,
};

const link = {
  color: emailTheme.colors.cocoa,
  fontWeight: 700,
  textDecoration: "underline",
};
