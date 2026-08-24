import type { ReactNode } from "react";

import { PublicAnalytics } from "@/components/public-analytics";

export default function BlogLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {children}
      <PublicAnalytics />
    </>
  );
}
