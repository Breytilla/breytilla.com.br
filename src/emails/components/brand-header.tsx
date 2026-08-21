import { Section, Text } from "react-email";

import { emailTheme } from "../theme";

interface BrandHeaderProps {
  label: string;
}

export function BrandHeader({ label }: BrandHeaderProps) {
  return (
    <Section style={header}>
      <Text style={wordmark}>
        Brey<span style={wordmarkAccent}>tilla</span>
      </Text>
      <Text style={descriptor}>{label}</Text>
    </Section>
  );
}

const header = {
  backgroundColor: emailTheme.colors.cocoaDeep,
  borderTop: `5px solid ${emailTheme.colors.earth}`,
  padding: "30px 44px 28px",
};

const wordmark = {
  color: emailTheme.colors.cream,
  fontFamily: emailTheme.fonts.display,
  fontSize: "31px",
  fontWeight: 500,
  letterSpacing: "-1.4px",
  lineHeight: "34px",
  margin: 0,
};

const wordmarkAccent = {
  color: emailTheme.colors.earth,
  fontStyle: "italic",
};

const descriptor = {
  color: "#d8cec4",
  fontFamily: emailTheme.fonts.body,
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "1.8px",
  lineHeight: "16px",
  margin: "10px 0 0",
  textTransform: "uppercase" as const,
};
