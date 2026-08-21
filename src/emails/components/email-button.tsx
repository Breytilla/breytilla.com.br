import type { ReactNode } from "react";
import { Button } from "react-email";

import { emailTheme } from "../theme";
import type { AbsoluteUrl } from "../types";

interface EmailButtonProps {
  children: ReactNode;
  href: AbsoluteUrl;
}

export function EmailButton({ children, href }: EmailButtonProps) {
  return (
    <Button href={href} style={button}>
      {children}
    </Button>
  );
}

const button = {
  backgroundColor: emailTheme.colors.cocoaDeep,
  border: `1px solid ${emailTheme.colors.cocoaDeep}`,
  borderRadius: "2px",
  color: emailTheme.colors.cream,
  display: "inline-block",
  fontFamily: emailTheme.fonts.body,
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "1.1px",
  lineHeight: "18px",
  padding: "15px 24px",
  textAlign: "center" as const,
  textDecoration: "none",
  textTransform: "uppercase" as const,
};
