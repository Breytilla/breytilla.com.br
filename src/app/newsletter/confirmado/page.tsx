import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Confirmação da newsletter | Breytilla",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function NewsletterConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const status = (await searchParams).status;
  const confirmed = status === "confirmed";

  return (
    <main className="privacy-page">
      <header className="container privacy-header">
        <Link className="wordmark" href="/" aria-label="Breytilla — início">
          Brey<em>tilla</em>
        </Link>
        <Link className="privacy-back" href="/">
          Voltar ao site
        </Link>
      </header>

      <article className="container privacy-content newsletter-result">
        <p className="eyebrow">
          {confirmed ? "Inscrição confirmada" : "Confirmação não concluída"}
        </p>
        <h1>
          {confirmed
            ? "Obrigada por confirmar."
            : "Este link não está mais disponível."}
        </h1>
        <p className="privacy-lead">
          {confirmed
            ? "Seu e-mail foi incluído na lista de conteúdos e novidades da Breytilla."
            : "Solicite uma nova confirmação pelo formulário da newsletter. Por segurança, não informamos se o link expirou ou já foi utilizado."}
        </p>
        <Link className="button button--primary" href="/">
          Voltar para o site
        </Link>
      </article>
    </main>
  );
}
