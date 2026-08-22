import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getPublishedPostBySlug } from "@/server/admin/posts";
import styles from "../blog.module.css";

type DateValue = Date | string | null | undefined;
type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

const getPost = cache(async (slug: string) => {
  await connection();
  return getPublishedPostBySlug(slug);
});

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

function splitIntoParagraphs(content: string) {
  return content
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return {
      title: "Artigo não encontrado | Breytilla",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = post.seoTitle?.trim() || `${post.title} | Breytilla`;
  const description = post.seoDescription?.trim() || post.excerpt;
  const canonical = `/blog/${encodeURIComponent(post.slug)}`;
  const publishedTime = dateTime(post.publishedAt) ?? undefined;
  const modifiedTime = dateTime(post.updatedAt) ?? publishedTime;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "article",
      url: canonical,
      siteName: "Breytilla Psicologia",
      title,
      description,
      publishedTime,
      modifiedTime,
      authors: ["Breytilla Katyeliny Silva Souza"],
      images: [
        {
          url: "/og.png",
          width: 1200,
          height: 630,
          alt: post.title,
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
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  const paragraphs = splitIntoParagraphs(post.content);
  const publishedLabel = formatDate(post.publishedAt);
  const publishedDateTime = dateTime(post.publishedAt);
  const updatedLabel = formatDate(post.updatedAt);
  const updatedDateTime = dateTime(post.updatedAt);
  const showUpdatedDate =
    updatedDateTime !== null && updatedLabel !== publishedLabel;
  const category = post.category?.trim() || "Reflexões";

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#artigo">
        Ir para o artigo
      </a>

      <header className={styles.siteHeader}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <Link className={styles.wordmark} href="/" aria-label="Breytilla — início">
            Brey<em>tilla</em>
          </Link>

          <nav className={styles.mainNav} aria-label="Navegação do blog">
            <Link href="/">Início</Link>
            <Link href="/blog" aria-current="page">
              Blog
            </Link>
            <Link href="/#sobre">Sobre</Link>
          </nav>

          <Link className={styles.homeLink} href="/blog">
            <ArrowLeft aria-hidden="true" />
            Todos os textos
          </Link>
        </div>
      </header>

      <main id="artigo">
        <article>
          <header className={styles.articleHero}>
            <div className={styles.articleOrbit} aria-hidden="true" />
            <div className={`${styles.container} ${styles.articleHeaderInner}`}>
              <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
                <Link href="/">Início</Link>
                <span aria-hidden="true">/</span>
                <Link href="/blog">Blog</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page">Artigo</span>
              </nav>

              <div className={styles.articleMeta}>
                <span>{category}</span>
                {publishedLabel && publishedDateTime ? (
                  <time dateTime={publishedDateTime}>{publishedLabel}</time>
                ) : null}
              </div>

              <h1>{post.title}</h1>
              <p className={styles.articleLead}>{post.excerpt}</p>
            </div>
          </header>

          <div className={`${styles.container} ${styles.articleLayout}`}>
            <div className={styles.articleBody}>
              {(paragraphs.length > 0 ? paragraphs : [post.excerpt]).map(
                (paragraph, index) => (
                  <p key={`${index}-${paragraph.slice(0, 32)}`}>{paragraph}</p>
                ),
              )}
            </div>

            <aside className={styles.articleAside} aria-label="Sobre este artigo">
              <p className={styles.asideLabel}>Escrito por</p>
              <p className={styles.asideAuthor}>Breytilla Katyeliny Silva Souza</p>
              <p>Psicóloga · CRP 06/180155</p>

              {showUpdatedDate && updatedLabel && updatedDateTime ? (
                <p className={styles.updatedDate}>
                  Atualizado em <time dateTime={updatedDateTime}>{updatedLabel}</time>
                </p>
              ) : null}
            </aside>
          </div>

          <footer className={styles.articleFooter}>
            <div className={`${styles.container} ${styles.articleFooterInner}`}>
              <div>
                <p className={styles.eyebrow}>Continue por perto</p>
                <h2>Outras reflexões podem acompanhar você.</h2>
              </div>
              <Link className={styles.primaryButton} href="/blog">
                Ver todos os textos
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </div>
          </footer>
        </article>
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
