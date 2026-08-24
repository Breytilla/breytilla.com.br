import type { ReactNode } from "react";

import { PublicAnalytics } from "@/components/public-analytics";

export default function PrivacyLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {children}
      <PublicAnalytics />
    </>
  );
}
