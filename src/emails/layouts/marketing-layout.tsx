import type { ReactNode } from "react";
import { Body, Container, Head, Html, Preview, Section } from "react-email";

import { BrandHeader } from "../components/brand-header";
import { EmailFooter } from "../components/email-footer";
import { emailStyles } from "../theme";
import type { UnsubscribeUrl } from "../types";

interface MarketingLayoutProps {
  children: ReactNode;
  preview: string;
  unsubscribeUrl: UnsubscribeUrl;
}

export function MarketingLayout({
  children,
  preview,
  unsubscribeUrl,
}: MarketingLayoutProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <BrandHeader label="Conteúdos e novidades" />
          <Section style={emailStyles.content}>{children}</Section>
          <EmailFooter
            stream="marketing"
            unsubscribeUrl={unsubscribeUrl}
          />
        </Container>
      </Body>
    </Html>
  );
}
