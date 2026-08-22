import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Área de gestão | Breytilla",
  description: "Área privada de gestão de conteúdo.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function AccessLayout({ children }: { children: ReactNode }) {
  return children;
}

