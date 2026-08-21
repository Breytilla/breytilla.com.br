import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Confirmar newsletter | Breytilla",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ConfirmNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const tokenValue = (await searchParams).token;
  const token = typeof tokenValue === "string" ? tokenValue : "";
  const validShape = /^[A-Za-z0-9_-]{43}$/.test(token);

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
        <p className="eyebrow">Confirmação de inscrição</p>
        <h1>
          {validShape
            ? "Deseja receber conteúdos e novidades?"
            : "Este link não está disponível."}
        </h1>
        <p className="privacy-lead">
          {validShape
            ? "Confirme abaixo para concluir sua inscrição. Nenhum conteúdo de marketing será enviado antes desta escolha."
            : "Solicite um novo link pelo formulário da newsletter no site."}
        </p>

        {validShape ? (
          <form action="/api/newsletter/confirm" method="post">
            <input name="token" type="hidden" value={token} />
            <button className="button button--primary" type="submit">
              Confirmar minha inscrição
            </button>
          </form>
        ) : (
          <Link className="button button--primary" href="/">
            Voltar para o site
          </Link>
        )}
      </article>
    </main>
  );
}
