import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowDown, ArrowLeft, ArrowUpRight } from "lucide-react";
import { NewsletterForm } from "@/components/email-forms";
import { listPublishedPosts } from "@/server/admin/posts";
import styles from "./blog.module.css";

type DateValue = Date | string | null;

const pageTitle = "Blog | Breytilla Psicologia";
const pageDescription =
  "Reflexões sobre ansiedade, autoestima, relacionamentos, autocuidado e presença, por Breytilla Katyeliny Silva Souza.";

const editorialTopics = [
  "Ansiedade",
  "Autoestima",
  "Relacionamentos",
  "Autocuidado",
  "Presença",
];

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
  let posts: Awaited<ReturnType<typeof listPublishedPosts>> = [];
  let postsUnavailable = false;

  try {
    posts = await listPublishedPosts();
  } catch (error) {
    postsUnavailable = true;
    console.error("[blog] Não foi possível carregar os posts publicados.", error);
  }

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#conteudo-blog">
        Ir para o conteúdo
      </a>

      <header className={styles.siteHeader}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <div className={styles.brandLockup}>
            <Link className={styles.wordmark} href="/" aria-label="Breytilla — início">
              Brey<em>tilla</em>
            </Link>
            <span aria-hidden="true">Caderno</span>
          </div>

          <nav className={styles.mainNav} aria-label="Navegação do blog">
            <Link href="/">Início</Link>
            <Link href="/blog" aria-current="page">
              Blog
            </Link>
            <Link href="/#sobre">Sobre</Link>
          </nav>

          <Link className={styles.homeLink} href="/">
            <ArrowLeft aria-hidden="true" />
            <span className={styles.homeLinkFull}>Voltar ao site</span>
            <span className={styles.homeLinkShort}>Site</span>
          </Link>
        </div>
      </header>

      <main id="conteudo-blog">
        <section className={styles.hero} aria-labelledby="blog-title">
          <div className={styles.heroOrbit} aria-hidden="true" />
          <div className={styles.heroGlow} aria-hidden="true" />

          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Caderno Breytilla · psicologia e cotidiano</p>
              <h1 id="blog-title">
                Palavras para <em>voltar a si.</em>
              </h1>
              <p className={styles.heroLead}>
                Reflexões sobre ansiedade, autoestima, relações e presença —
                para ler sem pressa, guardar o que fizer sentido e levar consigo.
              </p>

              <a className={styles.heroLink} href="#artigos">
                Começar a leitura
                <ArrowDown aria-hidden="true" />
              </a>
            </div>

            <div className={styles.heroMark}>
              <div className={styles.heroImageFrame}>
                <Image
                  src="/blog-hero-editorial.webp"
                  alt="Mulher sorrindo entre livros e plantas em luz natural"
                  fill
                  preload
                  sizes="(max-width: 920px) 86vw, (max-width: 1200px) 38vw, 430px"
                  className={styles.heroImage}
                />
              </div>

              <div className={styles.heroMonogram} aria-hidden="true">
                <span>B</span>
              </div>

              <div className={styles.heroCaption} aria-hidden="true">
                <span>01</span>
                <p>presença · escuta · encontro</p>
              </div>
            </div>
          </div>
        </section>

        <aside className={styles.topicsBar} aria-label="Temas do Caderno Breytilla">
          <div className={`${styles.container} ${styles.topicsInner}`}>
            <p>Por aqui, conversamos sobre</p>
            <ul>
              {editorialTopics.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          </div>
        </aside>

        <section
          className={styles.postsSection}
          id="artigos"
          aria-labelledby="posts-title"
        >
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Leituras para este momento</p>
                <h2 id="posts-title">
                  Textos para ler <em>com calma.</em>
                </h2>
              </div>
              <p>
                Um caderno de perguntas, descobertas e pequenos deslocamentos
                para acompanhar você no encontro com a própria experiência.
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

                        <span className={styles.postOrdinal} aria-hidden="true">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        {index === 0 ? (
                          <span className={styles.featuredMonogram} aria-hidden="true">
                            B
                          </span>
                        ) : null}

                        <div className={styles.postCopy}>
                          {index === 0 ? (
                            <p className={styles.featuredLabel}>Leitura em destaque</p>
                          ) : null}
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
              <div className={styles.emptyState}>
                <span aria-hidden="true">B</span>
                <h3>
                  {postsUnavailable
                    ? "Não foi possível trazer os textos agora."
                    : "Novos textos estão sendo preparados."}
                </h3>
                <p>
                  {postsUnavailable
                    ? "A página continua por aqui. Tente novamente em alguns instantes para acessar as leituras."
                    : "Em breve, este espaço receberá reflexões para acompanhar você com cuidado e sem pressa."}
                </p>
                {postsUnavailable ? (
                  <Link className={styles.emptyStateLink} href="/blog" prefetch={false}>
                    Tentar novamente
                  </Link>
                ) : (
                  <a className={styles.emptyStateLink} href="#newsletter">
                    Quero saber quando chegarem
                    <ArrowDown aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
          </div>
        </section>

        <section className={styles.journalNote} aria-labelledby="journal-note-title">
          <div className={`${styles.container} ${styles.journalNoteGrid}`}>
            <div className={styles.journalSignature} aria-hidden="true">
              <div className={styles.signatureOrbit}>
                <span>B</span>
              </div>
              <p>Breytilla · psicóloga e escritora</p>
            </div>

            <div className={styles.journalNoteCopy}>
              <p className={styles.eyebrow}>Por trás das palavras</p>
              <h2 id="journal-note-title">
                Uma escrita que nasce da <em>escuta.</em>
              </h2>
              <p>
                Este caderno prolonga algumas das perguntas que atravessam meu
                trabalho como psicóloga. Não para oferecer respostas prontas,
                mas para abrir pausas, ampliar olhares e ajudar você a reconhecer
                o que pede atenção no aqui e agora.
              </p>
              <Link className={styles.textLink} href="/#sobre">
                Conheça meu trabalho
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className={styles.newsletterSection} id="newsletter">
          <div className={styles.newsletterOrbit} aria-hidden="true" />
          <div className={styles.container}>
            <NewsletterForm />
          </div>
        </div>
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
            <a
              href="https://instagram.com/breytillak"
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram
            </a>
            <Link href="/privacidade">Privacidade</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
