import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const displayFont = Cormorant_Garamond({
  variable: "--font-display-loaded",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const bodyFont = Jost({
  variable: "--font-body-loaded",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const title = "Psicoterapia online para mulheres | Breytilla";
const description =
  "Psicoterapia individual online em Gestalt-terapia para mulheres adultas, com Breytilla Katyeliny Silva Souza, Psicóloga, CRP 06/180155.";

export const metadata: Metadata = {
  metadataBase: new URL("https://breytilla.com.br"),
  title,
  description,
  applicationName: "Breytilla Psicologia",
  authors: [{ name: "Breytilla Katyeliny Silva Souza" }],
  creator: "Breytilla Katyeliny Silva Souza",
  keywords: [
    "psicoterapia online",
    "psicóloga online",
    "Gestalt-terapia",
    "ansiedade",
    "autoestima",
    "relacionamentos",
    "autoconhecimento",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "Breytilla Psicologia",
    title,
    description,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Breytilla Katyeliny Silva Souza, Psicóloga, CRP 06/180155 — Psicoterapia online para mulheres",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${displayFont.variable} ${bodyFont.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
