import { Hr, Section } from "react-email";

import { EmailButton } from "../components/email-button";
import {
  EmailEyebrow,
  EmailHeading,
  EmailParagraph,
  EmailSubheading,
} from "../components/typography";
import { MarketingLayout } from "../layouts/marketing-layout";
import { emailStyles } from "../theme";
import {
  RESEND_UNSUBSCRIBE_PLACEHOLDER,
  type NewsletterEmailProps,
} from "../types";

export function NewsletterEmail({
  preheader,
  title,
  intro,
  sections,
  cta,
  unsubscribeUrl = RESEND_UNSUBSCRIBE_PLACEHOLDER,
}: NewsletterEmailProps) {
  return (
    <MarketingLayout preview={preheader} unsubscribeUrl={unsubscribeUrl}>
      <EmailEyebrow>Conteúdos e novidades</EmailEyebrow>
      <EmailHeading>{title}</EmailHeading>
      <EmailParagraph>{intro}</EmailParagraph>

      {sections.map((section, sectionIndex) => (
        <Section key={`${section.heading}-${sectionIndex}`}>
          <EmailSubheading>{section.heading}</EmailSubheading>
          {section.paragraphs.map((paragraph, paragraphIndex) => (
            <EmailParagraph key={`${sectionIndex}-${paragraphIndex}`}>
              {paragraph}
            </EmailParagraph>
          ))}
        </Section>
      ))}

      {cta ? (
        <>
          <Hr style={emailStyles.divider} />
          <Section style={actionSection}>
            <EmailButton href={cta.url}>{cta.label}</EmailButton>
          </Section>
        </>
      ) : null}
    </MarketingLayout>
  );
}

NewsletterEmail.PreviewProps = {
  preheader: "Uma pausa breve para olhar com mais presença para o cotidiano.",
  title: "Presença também se constrói nas pequenas pausas.",
  intro:
    "Nesta edição, compartilho uma reflexão breve para acompanhar você durante a semana.",
  sections: [
    {
      heading: "Um convite à observação",
      paragraphs: [
        "Ao longo do dia, experimente notar como você chega a cada atividade: com pressa, tensão, curiosidade ou disponibilidade.",
        "Não é preciso corrigir o que aparecer. Perceber com gentileza já pode abrir espaço para novas escolhas.",
      ],
    },
  ],
  cta: {
    label: "Conhecer o site",
    url: "https://breytilla.com.br/",
  },
  unsubscribeUrl: RESEND_UNSUBSCRIBE_PLACEHOLDER,
} satisfies NewsletterEmailProps;

export default NewsletterEmail;

const actionSection = {
  margin: "28px 0 2px",
};
