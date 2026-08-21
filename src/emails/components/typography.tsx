import type { CSSProperties, ReactNode } from "react";
import { Heading, Text } from "react-email";

import { emailStyles } from "../theme";

interface CopyProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function EmailEyebrow({ children, style }: CopyProps) {
  return <Text style={{ ...emailStyles.eyebrow, ...style }}>{children}</Text>;
}

export function EmailHeading({ children, style }: CopyProps) {
  return (
    <Heading as="h1" style={{ ...emailStyles.heading, ...style }}>
      {children}
    </Heading>
  );
}

export function EmailSubheading({ children, style }: CopyProps) {
  return (
    <Heading as="h2" style={{ ...emailStyles.subheading, ...style }}>
      {children}
    </Heading>
  );
}

interface EmailParagraphProps extends CopyProps {
  muted?: boolean;
}

export function EmailParagraph({
  children,
  muted = false,
  style,
}: EmailParagraphProps) {
  return (
    <Text
      style={{
        ...(muted ? emailStyles.mutedParagraph : emailStyles.paragraph),
        ...style,
      }}
    >
      {children}
    </Text>
  );
}
