import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { listPublishedPosts } from "@/server/admin/posts";
import styles from "./blog.module.css";

type DateValue = Date | string | null;

const pageTitle = "Blog | Breytilla Psicologia";
const pageDescription =
  "Reflexões sobre ansiedade, autoestima, relacionamentos, autocuidado e presença, por Breytilla Katyeliny Silva Souza.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    type: "website",
    url: "/blog",
    siteName: "Breytilla Psicologia",
    title: pageTitle,
    description: pageDescription,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Blog da Breytilla Psicologia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: ["/og.png"],
  },
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

function parseDate(value: DateValue) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: DateValue) {
  const date = parseDate(value);
  return date ? dateFormatter.format(date) : null;
}

function dateTime(value: DateValue) {
  return parseDate(value)?.toISOString() ?? null;
}

export default async function BlogPage() {
  await connection();
  const posts = await listPublishedPosts();

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#conteudo-blog">
        Ir para o conteúdo
      </a>

      <header className={styles.siteHeader}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <Link className={styles.wordmark} href="/" aria-label="Breytilla — início">
            Brey<em>tilla</em>
          </Link>

          <nav className={styles.mainNav} aria-label="Navegação do blog">
            <Link href="/">Início</Link>
            <Link href="/#psicoterapia">Psicoterapia</Link>
            <Link href="/#sobre">Sobre</Link>
          </nav>

          <Link className={styles.homeLink} href="/">
            <ArrowLeft aria-hidden="true" />
            Voltar ao site
          </Link>
        </div>
      </header>

      <main id="conteudo-blog">
        <section className={styles.hero} aria-labelledby="blog-title">
          <div className={styles.heroOrbit} aria-hidden="true" />
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Blog · reflexões e cuidado</p>
              <h1 id="blog-title">
                Um espaço para continuar <em>essa conversa.</em>
              </h1>
              <p className={styles.heroLead}>
                Textos para olhar com mais presença para o que você sente, para
                suas relações e para os caminhos que vem construindo.
              </p>
            </div>

            <div className={styles.heroMark} aria-hidden="true">
              <span>B</span>
              <p>presença · escuta · encontro</p>
            </div>
          </div>
        </section>

        <section className={styles.postsSection} aria-labelledby="posts-title">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Caderno Breytilla</p>
                <h2 id="posts-title">Textos mais recentes</h2>
              </div>
              <p>
                Conteúdos sobre autocuidado, ansiedade, autoestima,
                relacionamentos e o encontro consigo mesma.
              </p>
            </div>

            {posts.length > 0 ? (
              <div className={styles.postGrid}>
                {posts.map((post, index) => {
                  const publishedLabel = formatDate(post.publishedAt);
                  const publishedDateTime = dateTime(post.publishedAt);
                  const category = post.category?.trim() || "Reflexões";
                  const href = `/blog/${encodeURIComponent(post.slug)}`;
                  const titleId = `post-${index + 1}-title`;

                  return (
                    <article
                      className={styles.postCard}
                      aria-labelledby={titleId}
                      key={post.id}
                    >
                      <Link className={styles.postLink} href={href}>
                        <div className={styles.postMeta}>
                          <span>{category}</span>
                          {publishedLabel && publishedDateTime ? (
                            <time dateTime={publishedDateTime}>
                              {publishedLabel}
                            </time>
                          ) : null}
                        </div>

                        <div className={styles.postCopy}>
                          <h3 id={titleId}>{post.title}</h3>
                          <p>{post.excerpt}</p>
                        </div>

                        <span className={styles.readMore}>
                          Ler artigo
                          <ArrowUpRight aria-hidden="true" />
                        </span>
                      </Link>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyState} role="status">
                <span aria-hidden="true">B</span>
                <h3>Novos textos estão sendo preparados.</h3>
                <p>
                  Em breve, este espaço receberá reflexões para acompanhar você
                  com cuidado e sem pressa.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <div>
            <Link className={`${styles.wordmark} ${styles.footerWordmark}`} href="/">
              Brey<em>tilla</em>
            </Link>
            <p>Psicoterapia online para mulheres adultas</p>
          </div>

          <div className={styles.footerDetails}>
            <span>Breytilla Katyeliny Silva Souza · Psicóloga</span>
            <span>CRP 06/180155</span>
          </div>

          <nav className={styles.footerNav} aria-label="Links do rodapé">
            <Link href="/">Site</Link>
            <Link href="/privacidade">Privacidade</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
