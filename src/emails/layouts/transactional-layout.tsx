import type { ReactNode } from "react";
import { Body, Container, Head, Html, Preview, Section } from "react-email";

import { BrandHeader } from "../components/brand-header";
import { EmailFooter } from "../components/email-footer";
import { emailStyles } from "../theme";

interface TransactionalLayoutProps {
  children: ReactNode;
  preview: string;
}

export function TransactionalLayout({
  children,
  preview,
}: TransactionalLayoutProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <BrandHeader label="Breytilla Psicologia" />
          <Section style={emailStyles.content}>{children}</Section>
          <EmailFooter stream="transactional" />
        </Container>
      </Body>
    </Html>
  );
}
